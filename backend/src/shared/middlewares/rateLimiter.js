/**
 * Every rate limiter in the app, backed by Redis so the counters are shared
 * across processes.
 *
 * **Why Redis and not the default store.** `express-rate-limit`'s in-memory
 * store keeps a counter per process, so the real limit is `max × instances` and
 * every deploy resets it to zero. For a general API limiter that is merely
 * imprecise; for `authLimiter` it means "10 login attempts per 15 minutes" is
 * actually 10 per instance, and an attacker who keeps guessing across a rolling
 * deploy is never limited at all.
 *
 * **Why it fails CLOSED.** If Redis is unreachable these limiters reject rather
 * than wave traffic through. That is the opposite of the usual availability
 * instinct, and it is deliberate: a limiter that fails open is decorative
 * precisely when it matters, because "make Redis unavailable" is a cheaper
 * first step for an attacker than guessing passwords, and knocking out the
 * counter would unlock unlimited attempts. The cost is that a Redis outage
 * takes sign-in down — which is the correct trade for an auth surface, and is
 * documented in the failure table in docs/api/auth.md.
 *
 * **Why keys combine IP and email.** IP alone lets one attacker spread guesses
 * across a botnet; email alone lets a single IP walk a user list. The key
 * generator normalizes the email itself because the limiter runs *before* the
 * validator — `req.body` is not normalized yet at this point, so `Bob@X.com `
 * and `bob@x.com` would otherwise get separate budgets.
 *
 * See .claude/specs/auth/auth.sprint6.md §6.1–§6.2 and docs/api/auth.md
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import ApiResponse from '../utils/apiResponse.js';
import httpStatus from '../constants/httpStatus.js';
import { AUTH_CODES } from '../constants/authCodes.js';
import { redisClient } from '../../config/redis.js';
import { createLogger } from '../../config/logger.js';

const log = createLogger('rate-limit');

// A 429 goes through ApiResponse like every other failure AND carries
// data.code, because the frontend maps RATE_LIMITED to copy the same way it
// maps a wrong password. An error shape that is right everywhere except under
// load is wrong exactly when a user is most likely to see it.
const handler = (req, res) =>
  ApiResponse.error(res, httpStatus.TOO_MANY_REQUESTS, 'Too many requests, please try again later', {
    code: AUTH_CODES.RATE_LIMITED,
  });

/**
 * Normalizes the email the same way the validator will, so one address cannot
 * be given several budgets by varying case or whitespace. Falls back to the IP
 * alone for endpoints with no email in the body (refresh, oauth).
 */
// `ipKeyGenerator` — not `req.ip` — because an IPv6 client is routinely handed
// a whole /64 and can take a different /128 for every request, so keying on the
// raw address gives one attacker unlimited budgets. The helper collapses IPv6 to
// its subnet and leaves IPv4 alone. express-rate-limit v8 refuses to start
// without it, which is how this was caught rather than shipped.
const ipKey = (req) => ipKeyGenerator(req.ip);

const ipAndEmailKey = (req) => {
  const raw = req.body?.email;
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';

  // The address comes from ipKey above, which respects the app's `trust proxy`
  // setting — see app.js, where it is a hop count rather than `true`. With
  // `true`, a client can spoof X-Forwarded-For and mint a fresh budget per
  // request.
  //
  // (Nothing in this function may name the raw request-address property
  // directly: express-rate-limit v8 validates a custom keyGenerator by regexing
  // its SOURCE, comments included, and refuses to start if it sees the property
  // without the IPv6 helper beside it.)
  return email ? `${ipKey(req)}:${email}` : ipKey(req);
};

/**
 * Builds a limiter on the shared Redis client.
 *
 * `sendCommand` is the adapter `rate-limit-redis` expects; ioredis takes the
 * command name and arguments positionally rather than as one array.
 *
 * The `.catch` is what makes the failure closed: a rejected Redis command
 * would otherwise surface as an unhandled rejection and let the request through
 * while nothing counted it. Returning a value above every limit makes the
 * limiter reject instead.
 */
const buildStore = (prefix) =>
  new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (...args) =>
      redisClient.call(...args).catch((error) => {
        log.error({ err: error, prefix }, 'Redis unavailable — failing closed');
        throw error;
      }),
  });

const limiter = ({ name, windowMs, max, keyGenerator = ipAndEmailKey }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler,
    store: buildStore(name),
    // Without this, a store error propagates as a 500 from deep inside the
    // middleware. Catching it here turns "we cannot count" into "we refuse",
    // which is the failing-closed behaviour stated in the header.
    requestWasSuccessful: () => true,
  });

/**
 * Wraps a limiter so that a store failure becomes a 429 rather than a 500.
 *
 * `express-rate-limit` calls `next(err)` when its store rejects; we intercept
 * that and answer 429 with the standard envelope, so a Redis outage looks like
 * a limit to the client — refused, and refused in a shape the frontend already
 * renders — instead of an unexplained server error.
 */
const failClosed = (instance) => (req, res, next) =>
  instance(req, res, (error) => {
    if (!error) return next();

    log.error({ err: error, path: req.originalUrl }, 'Rate limiter store failed — refusing request');
    return handler(req, res);
  });

/* ── The limiters (sprint 6 §6.1) ────────────────────────────────────────
 *
 * They differ because the thing being guessed differs: login is a credential
 * guess, register is account-farming, recovery and resend use us as a mail
 * cannon aimed at an address the caller merely claims, and refresh is a
 * background call every open tab makes on a timer.
 */

// General write-endpoint limiter for non-auth modules.
const apiLimiter = failClosed(
  limiter({ name: 'api', windowMs: 15 * 60 * 1000, max: 100, keyGenerator: ipKey })
);

// Credential endpoints: login, verify-code, verify-email, reset-password.
const authLimiter = failClosed(limiter({ name: 'auth', windowMs: 15 * 60 * 1000, max: 10 }));

const registerLimiter = failClosed(limiter({ name: 'register', windowMs: 60 * 60 * 1000, max: 5 }));

// forgot-password and login/request-code.
const recoveryLimiter = failClosed(limiter({ name: 'recovery', windowMs: 60 * 60 * 1000, max: 5 }));

const resendLimiter = failClosed(limiter({ name: 'resend', windowMs: 60 * 60 * 1000, max: 3 }));

// Deliberately looser than login. Treating a timed background call like
// credential guessing signs out the most active users first.
const refreshLimiter = failClosed(
  limiter({
    name: 'refresh',
    windowMs: 15 * 60 * 1000,
    max: 60,
    keyGenerator: ipKey,
  })
);

const oauthLimiter = failClosed(
  limiter({
    name: 'oauth',
    windowMs: 15 * 60 * 1000,
    max: 20,
    keyGenerator: ipKey,
  })
);

/**
 * Invitation sending, keyed on the **workspace** rather than the caller.
 *
 * An admin mass-inviting sends mail from our domain to strangers who never
 * asked for it, so this is a spam-reputation guard, not an abuse counter — and
 * the workspace is the unit doing the sending. Keyed per user instead, three
 * admins in one workspace would get three times the budget.
 */
const inviteSendLimiter = failClosed(
  limiter({
    name: 'invite-send',
    windowMs: 60 * 60 * 1000,
    max: 50,
    keyGenerator: (req) => `ws:${req.params.workspaceId}`,
  })
);

/**
 * Public invitation lookup — keyed per IP, because the caller is by definition
 * unauthenticated. This is what makes brute-forcing a 256-bit token pointless
 * in practice as well as in theory.
 */
const inviteLookupLimiter = failClosed(
  limiter({
    name: 'invite-lookup',
    windowMs: 15 * 60 * 1000,
    max: 30,
    keyGenerator: ipKey,
  })
);

// Workspace creation — spam/farming prevention, not a plan-enforcement
// mechanism (there is no seat/workspace cap yet). Ten per hour is generous
// for a real user and cheap for an abuser to hit, which is the point.
const workspaceCreateLimiter = failClosed(
  limiter({ name: 'workspace-create', windowMs: 60 * 60 * 1000, max: 10, keyGenerator: ipKey })
);

// Project creation — same abuse-prevention purpose as the workspace limiter,
// three times the budget. Projects are created far more often than workspaces
// (a workspace is a place you set up once; a project is a thing you start), so
// ten per hour would bite a real team spinning up a quarter's work in one
// sitting. This is abuse protection, not a quota.
const projectCreateLimiter = failClosed(
  limiter({ name: 'project-create', windowMs: 60 * 60 * 1000, max: 30, keyGenerator: ipKey })
);

// Uploads — the one endpoint where a request costs DISK rather than a row, so
// the budget is per hour rather than per fifteen minutes and is deliberately
// tighter than `apiLimiter`. 60 files an hour is a working session's worth of
// attachments and a poor rate at which to fill a volume.
const uploadLimiter = failClosed(
  limiter({ name: 'upload', windowMs: 60 * 60 * 1000, max: 60, keyGenerator: ipKey })
);

/**
 * Type-ahead search, keyed on the CALLER rather than the address.
 *
 * Every other limiter here keys on the IP (plus an email where the body
 * carries one), because the caller is anonymous at the point it runs. Search
 * sits behind `authGuard`, so `req.user.id` exists and is the better key: an
 * office, a school or a VPN is one address and many people, and an
 * IP-keyed budget would have the twentieth person to type a query locked out
 * by the nineteenth. The address is kept as the fallback, since the limiter
 * still runs if the guard is ever reordered away from in front of it.
 *
 * 60 a minute is deliberately generous for a HUMAN and tight for a loop: the
 * client debounces at 250ms and refuses to ask below two characters, so a
 * person typing continuously lands near 4 requests a minute. A caller reaching
 * 60 is not typing.
 *
 * Unlike the project, task and sprint routes — which ship no limiter at all,
 * the gap docs/api/task.md §Rate limiting records — this endpoint gets one
 * because `contains` across three tables is a sequential scan per keystroke,
 * so it is the cheapest expensive request in the API. docs/api/search.md
 * §Rate limiting.
 */
const searchLimiter = failClosed(
  limiter({
    name: 'search',
    windowMs: 60 * 1000,
    max: 60,
    keyGenerator: (req) => (req.user?.id ? `u:${req.user.id}` : ipKey(req)),
  })
);

export {
  apiLimiter,
  authLimiter,
  registerLimiter,
  recoveryLimiter,
  resendLimiter,
  refreshLimiter,
  oauthLimiter,
  inviteSendLimiter,
  inviteLookupLimiter,
  workspaceCreateLimiter,
  projectCreateLimiter,
  uploadLimiter,
  searchLimiter,
};
