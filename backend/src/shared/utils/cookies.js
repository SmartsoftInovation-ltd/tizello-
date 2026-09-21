/**
 * The two auth cookies, set and cleared in exactly one place.
 *
 * **The refresh cookie's `path` is the highest-value line in the whole auth
 * design** (plan §4.1). Scoped to `/api/v1/auth/refresh`, the browser attaches
 * the refresh token to that one endpoint and to nothing else — so a successful
 * XSS on any other route can read neither cookie (both are `httpOnly`) *and*
 * cannot cause the refresh token to be sent anywhere it could be observed. Set
 * it to `/` and nothing fails, no test goes red, and the blast radius of every
 * future XSS silently doubles. That is why it is a constant here rather than an
 * argument.
 *
 * Both cookies are `sameSite: 'lax'`.
 *
 * The refresh cookie was `strict`, on the reasoning that no cross-site context
 * has a legitimate reason to trigger token rotation. **OAuth is exactly such a
 * context, and it broke the flow.** The provider redirects the browser to
 * `/api/v1/auth/:provider/callback`, which is a cross-site navigation, so the
 * browser silently dropped every `strict` cookie that response tried to set —
 * no error, no warning. A user who signed in with Google got an access cookie
 * that worked for fifteen minutes and no refresh cookie at all, and then was
 * asked to log in again. Password sign-in hid the bug: that request is made
 * server-to-server by Next, which re-sets the pair onto its own origin, so no
 * cross-site rule applies.
 *
 * `lax` is not a meaningful loss here. It withholds the cookie from cross-site
 * *subrequests* and from cross-site POSTs; it sends it only on a top-level
 * navigation. `POST /api/v1/auth/refresh` is a POST, so the one CSRF shape
 * `strict` was closing — a cross-site form or fetch rotating the session — is
 * closed by `lax` on this route too. What changes is that the OAuth callback's
 * own top-level navigation can now carry a `Set-Cookie` the browser keeps.
 *
 * Clearing must repeat the same `path`, `sameSite` and `domain` the cookie was
 * set with. A browser matches on those attributes, so a mismatched clear is a
 * silent no-op: the user believes they signed out and the cookie is still on
 * the machine.
 *
 * See .claude/specs/auth/auth.sprint1.md §1.4 and .claude/plan/authentication.md §4.1, §11.1
 */

import config from '../../config/env.js';

const ACCESS_COOKIE = 'tizello_access';
const REFRESH_COOKIE = 'tizello_refresh';

/**
 * The refresh endpoint, and the only path the refresh cookie is sent to.
 * Changing this string without changing the route (or the reverse) logs every
 * user out at their next refresh, because the cookie stops being attached.
 */
const REFRESH_COOKIE_PATH = '/api/v1/auth/refresh';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/**
 * `Secure` is derived, never configured. Local development is plain http and a
 * `Secure` cookie is dropped there without an error — the request simply
 * arrives with no cookie, which presents as "login does nothing". Tying it to
 * NODE_ENV means production cannot accidentally ship without it, and
 * development cannot accidentally ship with it.
 */
const baseOptions = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  domain: config.cookieDomain,
};

/**
 * `JWT_EXPIRY` as milliseconds, so the cookie cannot outlive the token inside
 * it — or die before it.
 *
 * It was hard-coded at 15 minutes while the token's own lifetime came from the
 * environment, so lowering `JWT_EXPIRY` left the browser holding a cookie that
 * was valid for three times as long as its contents. Every request in that gap
 * presented a dead token and cost a refresh round trip, and the proxy's
 * `accessTokenNeedsRefresh` was the only thing keeping it from being visible.
 *
 * Unparseable input falls back to the token's own default rather than throwing:
 * a typo in `JWT_EXPIRY` is already caught by `jsonwebtoken` at sign time, and
 * refusing to boot over a cookie attribute would be a worse failure.
 */
function expiryToMs(expiry) {
  const match = /^(\d+)\s*([smhd])$/.exec(String(expiry).trim());
  if (!match) return 5 * MINUTE;

  const amount = Number(match[1]);
  const unit = { s: 1000, m: MINUTE, h: 60 * MINUTE, d: DAY }[match[2]];
  return amount * unit;
}

const accessCookieOptions = {
  ...baseOptions,
  sameSite: 'lax',
  path: '/',
  maxAge: expiryToMs(config.jwtExpiry),
};

const refreshCookieOptions = {
  ...baseOptions,
  sameSite: 'lax',
  path: REFRESH_COOKIE_PATH,
  maxAge: config.auth.refreshTokenTtlDays * DAY,
};

/**
 * Sets both cookies. Callers pass whichever they have — the OAuth callback and
 * every sign-in path set both, but a refresh rotation that only re-issues one
 * would pass one.
 *
 * `browserDirect` widens the refresh cookie's path to `/`, and exists for the
 * OAuth callback alone.
 *
 * Every other sign-in is made by the Next server, which re-scopes the cookie
 * onto its own origin before the browser ever sees it (`forwardSetCookies` in
 * the frontend's api-client.ts, which rewrites any `/api/...` path to `/`).
 * The narrow path is real protection there: the browser holds a `/`-scoped
 * cookie for the *frontend* origin and never holds one for the API's.
 *
 * The OAuth callback is the one route the browser reaches directly, so nothing
 * re-scopes it. Left at `/api/v1/auth/refresh`, the cookie is stored against a
 * path the frontend never requests — the Next server cannot read it, cannot
 * forward it, and the session dies with the access token fifteen minutes later,
 * asking a user who just signed in with Google to sign in again.
 */
const setAuthCookies = (res, { accessToken, refreshToken }, { browserDirect = false } = {}) => {
  if (accessToken) res.cookie(ACCESS_COOKIE, accessToken, accessCookieOptions);
  if (refreshToken) {
    res.cookie(
      REFRESH_COOKIE,
      refreshToken,
      browserDirect ? { ...refreshCookieOptions, path: '/' } : refreshCookieOptions
    );
  }
};

/**
 * Clears both cookies, repeating the attributes they were set with (minus
 * `maxAge`, which `clearCookie` replaces with an expiry in the past).
 *
 * **The refresh cookie is cleared at BOTH paths.** A browser matches a clear on
 * `path` as well as name, so a clear that names one path leaves a cookie set at
 * the other in place — the user believes they signed out and the credential is
 * still on the machine. Since `setAuthCookies({ browserDirect })` can write it
 * at `/api/v1/auth/refresh` (every ordinary sign-in) or at `/` (the OAuth
 * callback), and nothing here knows which one a given session used, both are
 * cleared unconditionally. Clearing a path that holds no cookie is a no-op.
 */
const clearAuthCookies = (res) => {
  const { maxAge: _accessMaxAge, ...accessAttributes } = accessCookieOptions;
  const { maxAge: _refreshMaxAge, ...refreshAttributes } = refreshCookieOptions;

  res.clearCookie(ACCESS_COOKIE, accessAttributes);
  res.clearCookie(REFRESH_COOKIE, refreshAttributes);
  res.clearCookie(REFRESH_COOKIE, { ...refreshAttributes, path: '/' });
};

export {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  setAuthCookies,
  clearAuthCookies,
  accessCookieOptions,
  refreshCookieOptions,
};
