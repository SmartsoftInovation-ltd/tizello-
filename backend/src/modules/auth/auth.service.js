/**
 * Every auth business rule. Throws `AppError` with an explicit `data.code`;
 * never touches `req` or `res`, so each function is equally callable from a
 * controller, a worker, or the OAuth callback.
 *
 * Three rules run through the whole file and explain most of what looks odd:
 *
 * 1. **Uniform failure on the credential paths.** Login answers
 *    `INVALID_CREDENTIALS` for a wrong password and for an address with no
 *    account, and compares against a dummy hash in the second case so the two
 *    take the same time (spec §8). Splitting either the message or the timing
 *    rebuilds the user-enumeration oracle the shared answer exists to remove.
 * 2. **Raw secrets are never stored and never logged.** A token exists in
 *    memory, in the response or job payload that carries it, and as a hash in
 *    the database — nowhere else.
 * 3. **Sessions are rows, not claims.** Issuing a session writes a
 *    `RefreshToken`, so it can be revoked; the access token cannot be, which is
 *    the entire reason it lives 15 minutes.
 *
 * See .claude/rules/error-handling.md, .claude/specs/auth/auth.sprint2.md
 *      and docs/api/auth.md
 */

import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import { AUTH_CODES } from '../../shared/constants/authCodes.js';
import { isCommonPassword } from '../../shared/constants/commonPasswords.js';
import config from '../../config/env.js';
import prisma from '../../config/db.js';
import {
  signAccessToken,
  verifyAccessTokenIgnoringExpiry,
  mintOpaqueToken,
  hashToken,
  mintSixDigitCode,
  hashSixDigitCode,
  verifySixDigitCode,
  hashPassword,
  verifyPassword,
  mintFamilyId,
  DUMMY_PASSWORD_HASH,
} from '../../shared/utils/tokens.js';
import {
  enqueueRegistrationCodeEmail,
  enqueueLoginCodeEmail,
  enqueuePasswordResetEmail,
} from '../../queues/email.queue.js';
import invitationService from '../invitation/invitation.service.js';
import repository from './auth.repository.js';
import dto from './auth.dto.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Issues a session: an access token plus a brand-new refresh-token lineage.
 *
 * `familyId` is fresh here because this is a *sign-in* — every later refresh
 * inherits the same family, so revoking it kills exactly one sign-in's
 * descendants and leaves the user's other devices alone.
 *
 * `userAgent` and `ip` are recorded for incident forensics only. Both are
 * client-controlled strings and must never gate an authorization decision.
 */
const issueSession = async ({ user, userAgent, ip }, tx = prisma) => {
  const refreshToken = mintOpaqueToken();
  const familyId = mintFamilyId();

  await repository.createRefreshToken(
    {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      familyId,
      expiresAt: new Date(Date.now() + config.auth.refreshTokenTtlDays * DAY),
      userAgent: userAgent ?? null,
      ip: ip ?? null,
    },
    tx
  );

  // The family id rides in the access token so /logout can identify this
  // session — see signAccessToken and the logout service below.
  return { accessToken: signAccessToken(user, { familyId }), refreshToken };
};

/**
 * Mints a registration-verification code and queues the mail.
 *
 * Outstanding codes for the user are consumed first, so a resend (or a retry
 * of the invite-fallback path in `register`) leaves exactly one working code
 * rather than a growing set of them.
 *
 * The **raw** code goes into the job payload; only the bcrypt hash is stored.
 * The worker cannot recover it from the row, so passing it at enqueue time is
 * the only way the email can contain a working code.
 */
const issueRegistrationCode = async (user, tx = prisma) => {
  await repository.consumeOutstandingRegistrationCodes(user.id, tx);

  const code = mintSixDigitCode();

  await repository.createRegistrationCode(
    {
      userId: user.id,
      codeHash: await hashSixDigitCode(code),
      expiresAt: new Date(Date.now() + config.auth.registrationCodeTtlMinutes * MINUTE),
    },
    tx
  );

  return code;
};

/**
 * Creates an account.
 *
 * Returns `201 { user }` and **no session**: the address has not been proved
 * yet, and the frontend sends the user to `/verify-email?email=…` to enter the
 * code just emailed. The one exception is the invitation path in sprint 8,
 * where possession of the emailed invite token already proves the address.
 *
 * The duplicate-email `409` is an accepted enumeration leak (spec §8) —
 * registration cannot both refuse a duplicate and stay silent about why. Rate
 * limiting is the mitigation, not secrecy. This is the deliberate opposite of
 * the choice `login` makes, which is why both are spelled out.
 */
const register = async ({ name, email, password, inviteToken, userAgent, ip }) => {
  if (isCommonPassword(password)) {
    throw new AppError(
      httpStatus.UNPROCESSABLE_ENTITY,
      'That password is too common',
      AUTH_CODES.WEAK_PASSWORD
    );
  }

  const existing = await repository.findUserByEmail(email);
  if (existing) {
    throw new AppError(httpStatus.CONFLICT, 'An account already uses this email', AUTH_CODES.EMAIL_TAKEN);
  }

  const passwordHash = await hashPassword(password);

  // --- The invited path (§8.4) ---
  //
  // An invitation token proves the address the same way a verification email
  // would: it was mailed there and came back. So when one applies, the account
  // is created ALREADY VERIFIED and signed in, which is what breaks the
  // deadlock — register leaves you unverified, login refuses the unverified,
  // and the verification email is the thing you were never going to receive
  // because you came from an invite.
  //
  // Everything below is one transaction, and `applyInviteTokenOnRegister`
  // returns false rather than throwing on ANY problem: a bad, expired or
  // mismatched token must never cost the user their account.
  if (inviteToken) {
    const result = await prisma.$transaction(async (tx) => {
      const created = await repository.createUser(
        { name, email, passwordHash, emailVerifiedAt: new Date() },
        tx
      );

      const applied = await invitationService.applyInviteTokenOnRegister(
        { token: inviteToken, user: created },
        tx
      );

      return { created, applied };
    });

    if (result.applied) {
      const tokens = await issueSession({ user: result.created, userAgent, ip });

      return { user: dto.toUser(result.created), tokens, inviteApplied: true };
    }

    // The token did not apply, so nothing has proved this address after all.
    // Undo the optimistic verification and fall back to the ordinary flow —
    // the account survives, which is the whole point.
    const downgraded = await repository.updateUser(result.created.id, { emailVerifiedAt: null });
    const code = await issueRegistrationCode(downgraded);
    await enqueueRegistrationCodeEmail({ userId: downgraded.id, code });

    return { user: dto.toUser(downgraded), inviteApplied: false };
  }

  const user = await repository.createUser({ name, email, passwordHash });

  const code = await issueRegistrationCode(user);
  await enqueueRegistrationCodeEmail({ userId: user.id, code });

  return { user: dto.toUser(user) };
};

/**
 * Redeems a registration code and signs the user straight in.
 *
 * Same shape as `verifyLoginCodeAndSignIn` below — dummy-hash burn on a
 * missing record, expiry check, attempt-cap-then-burn, single-use consume —
 * because a registration code is the exact same low-entropy, attempt-capped
 * secret a login code is. Redeeming it proves the address exactly as a login
 * code or an emailed link would, so it sets `emailVerifiedAt` and issues a
 * session in the same step: there is no reason to make a newly-verified user
 * turn around and sign in again.
 */
const verifyRegistrationCodeAndSignIn = async ({ email, code, userAgent, ip }) => {
  const invalid = () =>
    new AppError(httpStatus.UNAUTHORIZED, "That code isn't right", AUTH_CODES.CODE_INVALID);

  const user = await repository.findUserByEmail(email);
  const record = user ? await repository.findLatestRegistrationCode(user.id) : null;

  if (!record) {
    await verifySixDigitCode(code, DUMMY_PASSWORD_HASH);
    throw invalid();
  }

  if (record.expiresAt <= new Date()) {
    await repository.consumeRegistrationCode(record.id);
    throw new AppError(httpStatus.GONE, 'That code has expired', AUTH_CODES.CODE_EXPIRED);
  }

  if (record.attempts >= config.auth.registrationCodeMaxAttempts) {
    await repository.consumeRegistrationCode(record.id);
    throw invalid();
  }

  if (!(await verifySixDigitCode(code, record.codeHash))) {
    await repository.incrementRegistrationCodeAttempts(record.id);
    throw invalid();
  }

  await repository.consumeRegistrationCode(record.id);

  const verified = user.emailVerifiedAt
    ? user
    : await repository.updateUser(user.id, { emailVerifiedAt: new Date() });

  const tokens = await issueSession({ user: verified, userAgent, ip });

  return { user: dto.toUser(verified), tokens };
};

/**
 * Re-sends a registration code.
 *
 * Returns nothing and throws nothing for an unknown or already-verified
 * address — the controller answers `202` either way. The status hides
 * *whether*; the padding in the controller hides *how long*, which is the
 * half that is easy to forget.
 */
const resendRegistrationCode = async ({ email }) => {
  const user = await repository.findUserByEmail(email);

  // No account, or already verified: silently do nothing. Re-sending to a
  // verified address would let anyone use us to mail a stranger on demand.
  if (!user || user.emailVerifiedAt) return;

  const code = await issueRegistrationCode(user);
  await enqueueRegistrationCodeEmail({ userId: user.id, code });
};

/**
 * Password sign-in.
 *
 * The dummy-hash comparison on the "no such user" branch is the load-bearing
 * line: without it this returns in single-digit milliseconds for an unknown
 * address and ~100ms for a real one, and the shared `INVALID_CREDENTIALS`
 * message becomes decorative. Same for an OAuth-only account, which has no
 * `passwordHash` at all.
 *
 * The verified check comes *after* the password check on purpose — telling an
 * anonymous caller "this address exists but is unverified" before they have
 * proved they own the password is the same leak by another route.
 *
 * `inviteToken` is the one thing that stands in for verification here, and
 * only for an address the invitation was actually sent to. See the block on
 * that branch below.
 */
const login = async ({ email, password, inviteToken, userAgent, ip }) => {
  const user = await repository.findUserByEmail(email);

  const passwordMatches = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !user.passwordHash || !passwordMatches) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "That email or password isn't right",
      AUTH_CODES.INVALID_CREDENTIALS
    );
  }

  // --- The invited path, for an account that already exists (§8.4) ---
  //
  // An invitation token mailed to this address and handed back here proves it,
  // exactly as a verification code would — the claim `acceptInvitation` and
  // `verifyLoginCodeAndSignIn` both already act on. Without this branch an
  // invited user who happened to register first is stuck: login refuses them
  // as unverified, and the accept screen that would have verified them is
  // behind the session login will not issue.
  //
  // Note where it sits: strictly AFTER the password check, so the token grants
  // nothing on its own. It substitutes for verification and for nothing else —
  // a correct token with a wrong password has already thrown above.
  let verifiedUser = user;

  if (!user.emailVerifiedAt && inviteToken) {
    const proves = await invitationService.tokenProvesEmail({ token: inviteToken, email });

    if (proves) {
      verifiedUser = await repository.updateUser(user.id, { emailVerifiedAt: new Date() });
    }
  }

  if (!verifiedUser.emailVerifiedAt) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Verify your email to continue',
      AUTH_CODES.EMAIL_NOT_VERIFIED
    );
  }

  const tokens = await issueSession({ user: verifiedUser, userAgent, ip });

  return { user: dto.toUser(verifiedUser), tokens };
};

/* ── Login codes: the DEFAULT sign-in path ───────────────────────────────
 *
 * Spec §1: "A code sent to the address just typed cannot be forgotten, which
 * deletes the single largest cause of failed sign-ins rather than decorating
 * it." Passwords remain available; codes are what the form offers first.
 */

/**
 * Issues a six-digit code and queues the mail. Never reveals whether the
 * address has an account — the controller answers 202 either way, padded.
 */
const requestLoginCode = async ({ email }) => {
  const user = await repository.findUserByEmail(email);
  if (!user) return;

  // A new request invalidates any outstanding code (spec §9). Done at issue
  // time rather than lazily at verify time, so there is never a window in which
  // two live codes exist and the older one — the one an attacker may have
  // shoulder-surfed — still works.
  await repository.consumeOutstandingLoginCodes(user.id);

  const code = mintSixDigitCode();

  await repository.createLoginCode({
    userId: user.id,
    codeHash: await hashSixDigitCode(code),
    expiresAt: new Date(Date.now() + config.auth.loginCodeTtlMinutes * MINUTE),
  });

  await enqueueLoginCodeEmail({ userId: user.id, code });
};

/**
 * Redeems a login code.
 *
 * The attempt counter lives on the row, not in Redis: 10^6 is small enough that
 * the cap — not the code length — is what makes a six-digit code safe, and a
 * cap that resets on deploy or on cache eviction is not a cap.
 *
 * Every failure returns the same CODE_INVALID, and a missing user still pays for
 * a bcrypt comparison, for the same enumeration reason as `login`.
 */
const verifyLoginCodeAndSignIn = async ({ email, code, userAgent, ip }) => {
  const invalid = () =>
    new AppError(httpStatus.UNAUTHORIZED, "That code isn't right", AUTH_CODES.CODE_INVALID);

  const user = await repository.findUserByEmail(email);
  const record = user ? await repository.findLatestLoginCode(user.id) : null;

  if (!record) {
    // No user, or no outstanding code. Burn the same time a real comparison
    // costs so the two are indistinguishable from outside.
    await verifySixDigitCode(code, DUMMY_PASSWORD_HASH);
    throw invalid();
  }

  if (record.expiresAt <= new Date()) {
    await repository.consumeLoginCode(record.id);
    throw new AppError(httpStatus.GONE, 'That code has expired', AUTH_CODES.CODE_EXPIRED);
  }

  // At or over the cap: burn the code outright. Checked BEFORE comparing, so
  // the attempt that trips the limit cannot also be the one that succeeds.
  if (record.attempts >= config.auth.loginCodeMaxAttempts) {
    await repository.consumeLoginCode(record.id);
    throw invalid();
  }

  if (!(await verifySixDigitCode(code, record.codeHash))) {
    // Increment on the row, not on a per-IP counter: otherwise an attacker
    // resets their budget by interleaving guesses against another address.
    await repository.incrementLoginCodeAttempts(record.id);
    throw invalid();
  }

  await repository.consumeLoginCode(record.id);

  // The code was delivered to that address, which proves ownership just as a
  // verification link does — so signing in this way verifies the address too.
  const verified = user.emailVerifiedAt
    ? user
    : await repository.updateUser(user.id, { emailVerifiedAt: new Date() });

  const tokens = await issueSession({ user: verified, userAgent, ip });

  return { user: dto.toUser(verified), tokens };
};

/* ── Password recovery ───────────────────────────────────────────────── */

/**
 * Mints a password-reset token and queues the mail. Silent for unknown
 * addresses; the controller pads and answers 202.
 */
const forgotPassword = async ({ email }) => {
  const user = await repository.findUserByEmail(email);

  // An OAuth-only account has no password to reset. Sending a reset link would
  // let anyone convert a Google-only account into a password account, which is
  // an account-takeover path dressed as a convenience.
  if (!user || !user.passwordHash) return;

  await repository.consumeOutstandingVerificationTokens(user.id, 'PASSWORD_RESET');

  const token = mintOpaqueToken();

  await repository.createVerificationToken({
    userId: user.id,
    tokenHash: hashToken(token),
    purpose: 'PASSWORD_RESET',
    expiresAt: new Date(Date.now() + config.auth.passwordResetTtlHours * HOUR),
  });

  await enqueuePasswordResetEmail({ userId: user.id, token });
};

/**
 * Sets a new password from a reset token.
 *
 * Two things this deliberately does NOT do:
 *
 *   - It does not sign the user in. Possession of an emailed link is not proof
 *     of identity (spec §6.4); they sign in afresh with the new password.
 *   - It does not spare the current session. **Every** refresh family for the
 *     user is revoked (spec §9) — a reset that leaves the attacker's session
 *     alive has accomplished exactly nothing, and "I changed my password" is
 *     precisely what a compromised user does first.
 */
const resetPassword = async ({ token, password }) => {
  if (isCommonPassword(password)) {
    throw new AppError(
      httpStatus.UNPROCESSABLE_ENTITY,
      'That password is too common',
      AUTH_CODES.WEAK_PASSWORD
    );
  }

  const record = await repository.findVerificationToken(hashToken(token), 'PASSWORD_RESET');

  if (!record || record.consumedAt) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This link is no longer valid', AUTH_CODES.TOKEN_INVALID);
  }

  if (record.expiresAt <= new Date()) {
    throw new AppError(httpStatus.GONE, 'This link has expired', AUTH_CODES.TOKEN_EXPIRED);
  }

  const passwordHash = await hashPassword(password);

  // One transaction: the new hash, the consumed token and the dead sessions all
  // land together. A partial apply here is the worst possible outcome — a
  // changed password with the old sessions still live reads as success and is
  // not.
  await prisma.$transaction(async (tx) => {
    await repository.updateUser(
      record.userId,
      {
        passwordHash,
        // Redeeming the link proves the address, so an unverified account that
        // resets its password becomes verified — the link did the same work a
        // verification email would have.
        ...(record.user.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }),
      },
      tx
    );
    await repository.consumeVerificationToken(record.id, tx);
    await repository.revokeAllUserRefreshTokens(record.userId, tx);
  });
};

/**
 * The idempotency window for a rotated refresh token, in milliseconds.
 *
 * **This constant is why correct rotation implementations survive contact with
 * production.** Two tabs whose access tokens expire in the same second both
 * present the same valid refresh token. One wins and rotates it; the second
 * arrives moments later holding a token that is now revoked — indistinguishable,
 * on the evidence, from a thief replaying a stolen token. Treat it as reuse and
 * an innocent user is signed out of every tab, intermittently, in a way nobody
 * can reproduce on demand. Ten seconds is far longer than any real race and far
 * shorter than a useful attack window.
 */
const REFRESH_GRACE_MS = 10 * 1000;

/**
 * Rotates a refresh token: the presented one is revoked and a successor issued
 * in the same family.
 *
 * The order of the checks below is a security property, not a style. `revokedAt`
 * is tested **before** `expiresAt`: a stolen token that has also aged out would
 * otherwise report "expired", the caller would shrug, and the theft alarm — the
 * single clearest signal of exfiltration this system produces — would never
 * fire.
 *
 * The rotation itself runs in one transaction. Split across two statements, a
 * crash between them leaves the old row revoked and no successor written, and
 * the user is silently signed out by an outage.
 */
const refresh = async ({ refreshToken, userAgent, ip }) => {
  if (!refreshToken) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Session expired', AUTH_CODES.TOKEN_INVALID);
  }

  const tokenHash = hashToken(refreshToken);
  const record = await repository.findRefreshTokenByHash(tokenHash);

  if (!record) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Session expired', AUTH_CODES.TOKEN_INVALID);
  }

  if (record.revokedAt) return refreshFromRevoked(record);

  if (record.expiresAt <= new Date()) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Session expired', AUTH_CODES.TOKEN_EXPIRED);
  }

  const nextToken = mintOpaqueToken();

  // One transaction: claim the old row, insert the successor, point the old row
  // at it. All, or nothing. The claim is a conditional update
  // (`claimRefreshToken`), so when two requests race with the same token only
  // one rotates; the loser sees zero rows and falls through to the revoked
  // path below, where it is inside the grace window and gets the winner's
  // session replayed instead of a second lineage.
  const rotated = await prisma.$transaction(async (tx) => {
    if ((await repository.claimRefreshToken(record.id, tx)) === 0) return false;

    const created = await repository.createRefreshToken(
      {
        userId: record.userId,
        tokenHash: hashToken(nextToken),
        // Same family: rotation extends a lineage, it does not start one. A
        // fresh familyId here would make every rotation un-revocable as a group
        // and defeat reuse detection entirely.
        familyId: record.familyId,
        expiresAt: new Date(Date.now() + config.auth.refreshTokenTtlDays * DAY),
        userAgent: userAgent ?? null,
        ip: ip ?? null,
      },
      tx
    );

    await repository.setRefreshTokenSuccessor(record.id, created.id, tx);
    return true;
  });

  if (!rotated) return refreshFromRevoked(await repository.findRefreshTokenByHash(tokenHash));

  return {
    user: dto.toUser(record.user),
    tokens: {
      accessToken: signAccessToken(record.user, { familyId: record.familyId }),
      refreshToken: nextToken,
    },
  };
};

/**
 * A presented refresh token that is already revoked: either the tail of a race
 * (another request rotated it moments ago) or a replay of a spent token.
 *
 * Split out of `refresh` because two paths reach it — a token read as revoked,
 * and a token that lost the rotation claim to a concurrent request.
 */
const refreshFromRevoked = async (record) => {
  const withinGrace = Date.now() - record.revokedAt.getTime() <= REFRESH_GRACE_MS;

  // A revoked token WITH a successor, presented within the window, is the tab
  // race — replay the already-issued replacement rather than raising an alarm.
  // The check keys on `replacedById` as well as on time, and must: a revoked
  // token with no replacement is a logout, and replaying that would resurrect
  // a session the user deliberately ended.
  if (withinGrace && record.replacedById) {
    const replacement = await repository.findRefreshTokenById(record.replacedById);

    if (replacement && !replacement.revokedAt) {
      return {
        user: dto.toUser(record.user),
        tokens: {
          accessToken: signAccessToken(record.user, { familyId: replacement.familyId }),
          // Deliberately no new refresh token: the winning request already set
          // that cookie. Re-issuing here would rotate a token this caller
          // never asked to rotate and restart the race.
        },
        replayed: true,
      };
    }
  }

  // Outside the window, or with no successor: this token was already spent and
  // is being presented again. Assume the copy is not in the owner's hands and
  // kill the whole lineage — every descendant of that one sign-in.
  await repository.revokeRefreshTokenFamily(record.familyId);

  throw new AppError(httpStatus.UNAUTHORIZED, 'Session expired', AUTH_CODES.TOKEN_INVALID, {
    reuseDetected: true,
    userId: record.userId,
    familyId: record.familyId,
  });
};

/**
 * Ends a session.
 *
 * Takes no guard and never throws: logging out with an already-expired access
 * token must still clear the cookies, or the user is stranded in a state they
 * cannot leave. An absent or unrecognised refresh token is therefore a
 * successful logout, not a `401`.
 *
 * Revocation is by **family**, not by row — killing only the presented token
 * would leave its already-issued successor alive.
 */
const logout = async ({ accessToken, refreshToken }) => {
  // Path is the reason this is not simply "hash the refresh cookie". The
  // refresh cookie is scoped to /api/v1/auth/refresh, so a browser never sends
  // it here — logout that only looked at it would silently revoke nothing while
  // still clearing the cookies, leaving a live refresh token on a stolen
  // machine and a 204 that says otherwise. The access token, which IS sent
  // here, names its own family.
  if (accessToken) {
    try {
      // Expired is expected and fine: the signature is still checked, so the
      // family id is still trustworthy.
      const { fid } = verifyAccessTokenIgnoringExpiry(accessToken);
      if (fid) {
        await repository.revokeRefreshTokenFamily(fid);
        return;
      }
    } catch {
      // Unsigned, tampered, or issued under a rotated secret. Fall through:
      // logout still clears cookies and still answers 204, because a caller who
      // cannot prove anything is exactly the caller who most needs the cookies
      // gone.
    }
  }

  // Non-browser clients (Bearer, no path scoping) can present the refresh token
  // directly, so honour it when it is actually there.
  if (!refreshToken) return;

  const record = await repository.findRefreshTokenByHash(hashToken(refreshToken));
  if (!record) return;

  await repository.revokeRefreshTokenFamily(record.familyId);
};

/**
 * The current user, for `GET /session`. Re-read from the database rather than
 * returned from the access token's claims: the token's `emailVerified` can be
 * up to 15 minutes stale, and this endpoint exists precisely to be authoritative.
 */
const getSession = async ({ userId }) => {
  const user = await repository.findUserById(userId);

  if (!user) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required', AUTH_CODES.TOKEN_INVALID);
  }

  return { user: dto.toUser(user) };
};

export default {
  register,
  refresh,
  requestLoginCode,
  verifyLoginCodeAndSignIn,
  forgotPassword,
  resetPassword,
  verifyRegistrationCodeAndSignIn,
  resendRegistrationCode,
  login,
  logout,
  getSession,
  issueSession,
  REFRESH_GRACE_MS,
};
