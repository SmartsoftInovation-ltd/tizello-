# `auth` — API contract

**Module:** `src/modules/auth/` · **Route prefix:** `/api/v1/auth`

> **Sibling-contract check.** Response envelope, `AppError` shape,
> validation-error shape, guard middleware names and rate-limiter precedent all
> match the house conventions in
> [api-response](../../.claude/skills/api-response/SKILL.md) and
> [module-consistency](../../.claude/skills/module-consistency/SKILL.md):
> `{ success, statusCode, message, data }` from `ApiResponse`, services throwing
> `AppError`, `validate(schema)` producing `400` with a per-field `details`
> array, `authGuard` / `loadMembership` / `requirePermission` from
> `shared/middlewares/`. `invitation` is the only sibling module today and
> agrees on all five — see [invitation.md](./invitation.md).
>
> **Deliberate divergences, five of them:**
>
> 1. **`data.code`, not `error.code`.** The frontend's `AuthErrorCode` is a
>    closed union and the UI renders copy from the code, ignoring `message`
>    entirely, so a server string can never reach a user's screen. The code
>    therefore rides inside the existing `data` object rather than in a new
>    top-level `error` key, which would have meant a second error envelope
>    beside the one every other module already sends. Plan §2.2.
> 2. **`/logout` takes no guard.** Every other mutating endpoint in the codebase
>    sits behind `authGuard`. Logging out with an already-expired access token
>    must still clear cookies, or the user is stranded in a state they cannot
>    leave. See §11.
> 3. **`/refresh` gets a *looser* limiter than login** (60/15m vs 10/15m). It is
>    a background call every open tab makes on a timer, not a credential guess;
>    limiting it like one signs out the most active users first.
> 4. **A seventh file, `auth.oauth.service.js`.** The house rule is six files per
>    module. `auth.service.js` already carries password auth, code auth and token
>    rotation; adding provider linking would have made it the largest file in the
>    codebase by a wide margin. Plan §12.3 sanctions the split.
> 5. **Nothing here is cached.** Every sibling may cache reads. A stale hit on
>    this surface means a revoked token still answering, which is the one thing
>    this module exists to prevent. See §*Caching* below.

---

## Identity model — read this before any endpoint below

**The identifier is the email address, normalized once.** Every validator in
`auth.validator.js` applies `.trim().lowercase()`, and `validate` writes the
coerced value back onto `req.body`, so every layer below sees the canonical
form. `Alice@Example.com ` and `alice@example.com` are one account.

Normalization happens in exactly one place. The single exception is the rate
limiter, which runs *before* the validator and therefore lowercases its own key
(`shared/middlewares/rateLimiter.js`) — otherwise one address would get several
budgets by varying case.

### Account states

An account is described by two nullable columns, not by a status enum:

| Column | Meaning when null |
|---|---|
| `emailVerifiedAt` | address not yet proved |
| `passwordHash` | OAuth-only account, no password to check |

Both are timestamps/absences rather than booleans on purpose. `emailVerifiedAt`
answers *when* as well as *whether*, which a boolean throws away and cannot
reconstruct; `passwordHash IS NULL` is what makes `login` and `forgot-password`
refuse an OAuth-only account instead of silently offering a password path onto
it.

### Legal transitions

```
unverified ──registration code redeemed─► verified  (the code proved the address)
           ──login-code redeemed────────►          (the code proved the address)
           ──reset-password─────────────►          (the link proved the address)
           ──invitation accepted────────►          (the invite proved the address)
           ──OAuth link (verified)──────►
```

Verification is one-way: nothing sets `emailVerifiedAt` back to null. Five
separate paths set it, and they all rest on the same argument — *a secret was
delivered to that address and came back*, which is precisely what a
registration code (or any of the others) establishes. Redeeming the
registration code additionally issues a session in the same step — see
*OTP* below — so there is no separate "now log in" round-trip after
verifying.

---

## Tokens and sessions

| Setting | Env var | Default |
|---|---|---|
| Access-token lifetime | `JWT_EXPIRY` | `15m` |
| Access-token signing secret | `JWT_SECRET` | — (required) |
| Refresh-token lifetime | `REFRESH_TOKEN_TTL_DAYS` | `30` |
| Refresh rotation grace window | *code constant* | `10s` |
| bcrypt cost | `BCRYPT_COST` | `12` (floored, see below) |
| Cookie domain | `COOKIE_DOMAIN` | unset → host-only |

**The access token is a signed JWT and is never checked against the database.**
That is what makes it cheap, and it is also why it cannot be revoked: a claim
inside it is true until it expires. Fifteen minutes is the bound on that trade.
It carries `sub`, `email`, `emailVerified` and `fid` — the last being the
refresh-token family, which is what lets `/logout` work (§11).

**The refresh token is 32 CSPRNG bytes, stored as a SHA-256 hash**, so a database
dump is not a set of working sessions. It is *not* bcrypt: there is no
low-entropy secret to slow an attacker down, and refresh runs on every
access-token expiry, where a deliberate 100ms KDF would be a tax on every active
session bought for nothing. Login codes make the opposite choice for the opposite
reason — see *OTP* below.

`BCRYPT_COST` is floored at 12 in `config/env.js` (`Math.max(12, …)`). Raising it
is always safe; lowering it silently weakens every hash written afterwards while
leaving existing ones alone, so the environment cannot go below the spec's floor.

### Cookies

| Cookie | `sameSite` | `path` | Lifetime |
|---|---|---|---|
| `tizello_access` | `lax` | `/` | 15m |
| `tizello_refresh` | `lax` | **`/api/v1/auth/refresh`**, or `/` from the OAuth callback | 30d |

Both are `httpOnly`; `secure` is derived from `NODE_ENV === 'production'` rather
than configured, because a `Secure` cookie is silently dropped over plain http
and local development is http — the symptom is "login does nothing".

**The refresh cookie's `path` is the highest-value line in the design**, and it
holds for every sign-in the Next server proxies. Scoped to the one endpoint that
consumes it, the browser will not attach the refresh token anywhere else, so an
XSS on any other route can neither read it (both are `httpOnly`) nor cause it to
be sent somewhere observable.

**The OAuth callback is the exception, and has to be.** Every other sign-in is a
server-to-server request from Next, which re-scopes the cookie onto its own
origin before the browser sees it — the browser ends up holding a `/`-scoped
cookie for the *frontend* and none at all for the API. The OAuth callback is the
one route the browser reaches directly, so nothing re-scopes it: left narrow,
the cookie is stored against a path the frontend never requests, the Next server
cannot read or forward it, and the session dies with the access token fifteen
minutes later. `setAuthCookies(res, tokens, { browserDirect: true })` writes `/`
for that one caller. `clearAuthCookies` clears both paths, because a clear that
names the wrong `path` is a silent no-op.

**Both cookies are `lax`.** The refresh cookie was `strict`, on the reasoning
that no cross-site context has a legitimate reason to rotate a session — but
**OAuth is exactly such a context**. The provider's redirect into
`/api/v1/auth/:provider/callback` is a cross-site navigation, so the browser
dropped every `strict` cookie that response set, with no error: a user who
signed in with Google was asked to sign in again as soon as the access token
lapsed. `lax` costs nothing here, because `POST /api/v1/auth/refresh` is a POST
and `lax` withholds the cookie from cross-site POSTs — the CSRF shape `strict`
was closing on this route is closed either way.

---

## Refresh rotation and reuse detection

Every refresh **rotates**: the presented token is revoked and a successor issued
in the same `familyId`. Three rules make that safe.

**1. `revokedAt` is checked before `expiresAt`.** Reversed, a stolen token that
had also aged out would report "expired", the caller would shrug, and the theft
alarm — the clearest signal of exfiltration this system produces — would never
fire.

**2. Rotation runs in one transaction, and starts with a conditional claim.**
Split into two statements, a crash between them leaves the old row revoked and
no successor written: the user is signed out by an outage.

The claim is `UPDATE … SET revokedAt = now() WHERE id = ? AND revokedAt IS NULL`
(`claimRefreshToken`), and only a request that claimed the row (1 row updated)
mints a successor. An earlier version read the row, saw it live, and then
rotated — so N concurrent refreshes with one token ALL passed the check and
minted N successors, of which the browser could keep only one. Postgres
re-evaluates the `WHERE` for a waiting `UPDATE` once the first commits, so
exactly one request wins; the others see 0 rows, re-read the now-revoked row,
and take the grace path in §3.

The web client adds the other half of this: it renews in its proxy, before a
page renders (`frontend/src/proxy.ts`, `lib/session-refresh.ts`). A refresh
issued from inside a Server Component render could not save the rotated cookie,
so the browser kept a spent token and its next request — past the grace window —
was treated as reuse and ended the session.

**3. A 10-second grace window, keyed on `replacedById`.** Two tabs whose access
tokens expire in the same second both present the same refresh token. One wins;
the second arrives holding a token that is now revoked and is, on the evidence,
indistinguishable from a replay. Treated as reuse, it signs an innocent user out
of every tab, intermittently, in a way nobody can reproduce on demand. **This is
the most common reason a correct rotation implementation gets reverted in
production.** Within the window, a revoked token *that has a successor* returns
the already-issued replacement — an idempotent replay. The `replacedById`
condition is load-bearing: a revoked token with no successor is a logout, and
replaying that would resurrect a session the user deliberately ended.

Outside the window, the entire family is revoked and the caller gets `401`. The
event is logged at `warn` with `userId` and `familyId` through `req.log`, so it
carries the request id. **The client is told nothing** — the response is the same
`401` an unknown token gets, because confirming "that token was real once" is
itself information.

### Revocation matrix

| Event | Effect |
|---|---|
| `POST /logout` | revoke that family |
| Reuse detected | revoke that family |
| `POST /reset-password` | revoke **every** family for the user |
| User deleted | cascade drops every row |
| Access token | never revoked — expires in 15m |

---

## OTP — login codes and registration codes

Two tables, same shape, different table for the reason given in
`.claude/plan/authentication.md` §3.4: a low-entropy, attempt-capped secret
must not share a table with the high-entropy, single-shot `VerificationToken`
below, so it gets its own rather than a purpose column bolted onto either.

| Setting | Env var | Default | Table |
|---|---|---|---|
| Code length | *code constant* | 6 digits | both |
| Login TTL | `LOGIN_CODE_TTL_MINUTES` | `10` | `LoginCode` |
| Login max attempts | `LOGIN_CODE_MAX_ATTEMPTS` | `5` | `LoginCode` |
| Registration TTL | `REGISTRATION_CODE_TTL_MINUTES` | `5` | `RegistrationCode` |
| Registration max attempts | `REGISTRATION_CODE_MAX_ATTEMPTS` | `5` | `RegistrationCode` |

The registration TTL is shorter because that code is entered in the same
sitting as sign-up, not retrieved hours later.

Six digits is 10⁶ possibilities, so **the attempt cap, not the length, is what
makes either code safe.** Two consequences follow.

First, both are **bcrypt**-hashed, unlike every other token here: a SHA-256 of a
10⁶ space falls to a dictionary in milliseconds on a stolen dump, so the slow KDF
is the entire defence.

Second, **the attempt counter lives on the row, never in Redis.** A cap that
resets on deploy or on cache eviction is not a cap. The counter is incremented
on the row for a wrong guess, so an attacker cannot reset their budget by
interleaving guesses against a different address.

Requesting a new code consumes any outstanding one at issue time rather than
lazily at verification, so there is never a window in which two live codes
exist. Redeeming either code sets `emailVerifiedAt` if it was null and issues a
session in the same step — see `issueSession` in `auth.service.js` — which is
also what the registration-code redemption route does, rather than a separate
"now log in" step.

---

## Rate limiting

Backed by Redis (`rate-limit-redis` on the shared `redisClient`) so counters are
shared across processes. With the default in-memory store the real limit is
`max × instances` and it resets on every deploy — merely imprecise for a general
API, but for `authLimiter` it means an attacker guessing across a rolling deploy
is never limited at all.

| Limiter | Window / max | Endpoints | Why |
|---|---|---|---|
| `authLimiter` | 15m / 10 | login, verify-code, verify-registration-code, reset-password | credential guessing; the tightest budget |
| `registerLimiter` | 1h / 5 | register | account farming, and the duplicate-email `409` is an enumeration oracle this bounds |
| `recoveryLimiter` | 1h / 5 | forgot-password, request-code | mails a credential to an address the caller merely claims |
| `resendLimiter` | 1h / 3 | resend-registration-code | tightest of the mail paths: pure re-send, no other purpose |
| `refreshLimiter` | 15m / 60 | refresh | a timed background call from every open tab, not a guess |
| `oauthLimiter` | 15m / 20 | provider start + callback | bounds state-guessing and provider round trips |

**Keys combine IP and normalized email.** IP alone lets one attacker spread
guesses across a botnet; email alone lets a single IP walk a user list. The IP
component goes through `express-rate-limit`'s `ipKeyGenerator`, which collapses
IPv6 to its subnet — an IPv6 client is routinely handed a whole /64 and can take
a different /128 per request, so keying on the raw address hands one attacker
unlimited budgets.

`app.set('trust proxy', …)` is a **hop count**, never `true`. With `true`, Express
trusts the leftmost `X-Forwarded-For` entry, which the client supplies — so a
caller mints a fresh budget per request and every limit becomes advisory.

### Failure modes

| Condition | Behaviour | Why |
|---|---|---|
| Redis unreachable | **Fail CLOSED** — `429` with the standard envelope | A limiter that fails open is decorative exactly when it matters: knocking out the counter is a cheaper first step than guessing passwords. The cost — a Redis outage takes sign-in down — is the correct trade on an auth surface. |
| Redis reachable, command errors | Fail closed, logged at `error` | Same reasoning; "we cannot count" must mean "we refuse", not "we allow". |
| Provider (Google/GitHub) unreachable | `302 /sign-in?error=SERVER_ERROR` | Never a raw stack in a browser mid-navigation. |
| SMTP down | Job retries with exponential backoff; the endpoint already returned | Mail is queued, never sent inline — see `src/queues/email.queue.js`. |
| Postgres down | `500`, generic message | Driver text names tables and library versions. |

---

## Account enumeration

The module makes **two opposite choices deliberately**, and the split is the
thing to understand before changing either.

**Uniform, on the credential paths.** `POST /login` answers
`401 INVALID_CREDENTIALS` for a wrong password *and* for an address with no
account. Spec §8: the ambiguity is the enumeration defence and must not be split
into two honest messages. It is defended in three layers:

1. the same code and the same message;
2. a **bcrypt comparison against a dummy hash** when the user does not exist
   (`DUMMY_PASSWORD_HASH` in `shared/utils/tokens.js`), so the two branches cost
   the same — without it, an unknown address returns in single-digit
   milliseconds and a real one in ~100ms, and the shared message is decorative;
3. the verified check runs *after* the password check, so an anonymous caller
   is never told "this address exists but is unverified".

**`202` always, on the mail paths.** `resend-registration-code`,
`login/request-code` and `forgot-password` answer identically whether or not
the address exists, and
each is padded to a constant ~250ms floor by `withMinimumDuration`
(`shared/utils/timing.js`). The uniform status hides *whether*; the padding hides
it in the clock, and only both together close the oracle.

### Residual oracles, knowingly left open

1. **`POST /register` returns `409 EMAIL_TAKEN`.** Registration cannot both
   refuse a duplicate and stay silent about why. Bounded by `registerLimiter`
   (5/hr) — spec §8 accepts this explicitly: rate limiting is the mitigation,
   not secrecy.
2. **`403 EMAIL_NOT_VERIFIED` on login confirms an account exists** — but only to
   a caller who has already produced the correct password, which makes it not an
   oracle in any useful sense.
3. **Timing padding is a floor, not a constant.** A request slower than 250ms
   (a cold bcrypt, a slow query) overshoots it. The floor is set well above the
   slow path's typical cost so this is rare; it is not a constant-time guarantee.

---

## Caching

**Nothing on this surface is cached, and that is a divergence from every sibling
module.** A stale hit here means a revoked token still answering — the precise
failure the rotation and revocation machinery exists to prevent. `GET /session`
in particular re-reads the user row rather than trusting the access token's
claims, because the token's `emailVerified` can be up to 15 minutes stale and
this endpoint exists to be authoritative.

Redis is used on this surface for rate-limit counters only.

---

## Guards

`authGuard` (`shared/middlewares/auth.js`) protects `GET /session` and nothing
else in this module. It reads `tizello_access` **cookie first, `Authorization:
Bearer` second** — the browser client is cookie-based and cannot read an
`httpOnly` cookie to build a header; the Bearer path costs one line and leaves
the door open for a mobile or server-to-server client with no cookie jar.

It distinguishes `TOKEN_EXPIRED` from `TOKEN_INVALID`, **and that distinction is
a protocol**: the frontend calls `/refresh` on the first and signs the user out on
the second. Collapsing them either strands users with a renewable session or
sends them into a refresh loop against a token that will never work.

`clockTolerance: 60` on verification is required, not padding: a 15-minute token
issued by one instance and verified by another whose clock is seconds ahead is
otherwise rejected at random near expiry — which reads to a user as "signed out
for no reason" and is nearly impossible to reproduce.

**What is deliberately not used:** `loadMembership` and `requirePermission` appear
nowhere in this module. Every endpoint acts on the caller's own account, resolved
from `req.user.id` or from a token, never from a workspace role and never from an
id in the body.

---

## 1. `POST /api/v1/auth/register`

Creates an account. Public. `registerLimiter` (1h / 5).

| Field | Rules |
|---|---|
| `name` | string, 2–80, trimmed |
| `email` | string, ≤254, valid, **lowercased + trimmed** |
| `password` | string, 8–128 |
| `inviteToken` | optional string, ≤200 |

The 128-character cap is a resource bound, not a security property — bcrypt
truncates at 72 bytes, so beyond that nothing is contributing entropy. There are
no composition rules (a digit, a symbol, mixed case): those push users toward
`Passw0rd!` — which is on the common-password list — while blocking the long
passphrases that are actually strong. Length plus a common-password check is the
modern guidance and matches what the frontend enforces.

`inviteToken` is validated only as "a string". A bad token must **not** fail the
registration (§8.4): losing an account because an invitation expired mid-signup
is a worse outcome than an extra click.

**`201`**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Account created",
  "data": {
    "user": {
      "id": "cmtpakkau0000r2j2fvq8c44r",
      "name": "Ada Lovelace",
      "email": "ada@example.com",
      "emailVerified": false,
      "createdAt": "2026-09-06T04:08:27.846Z"
    }
  }
}
```

**No session is issued** — the address has not been proved yet, and the
frontend redirects to `/verify-email?email=…` to collect the 6-digit code this
call just enqueued. The one exception is a valid `inviteToken`, which sets
`emailVerified: true`, adds `"inviteApplied": true` to `data`, and *does* set
both cookies: possession of the emailed token already proves the address. See
[invitation.md](./invitation.md) §*The deadlock*.

`data.user` never contains `passwordHash`, a token, or the raw `emailVerifiedAt`
timestamp — `auth.dto.js` whitelists five fields rather than deleting unwanted
ones, so a column added to the model later cannot leak by default.

**Errors**

| Status | When |
|---|---|
| `400` | Validation failed. `data.details` carries `{ field, message }` per input. |
| `409` | `EMAIL_TAKEN`. A knowing enumeration leak — see *Residual oracles*. |
| `422` | `WEAK_PASSWORD`. The password is on the common-password list in `shared/constants/commonPasswords.js`. |
| `429` | `RATE_LIMITED`. |

---

## 2. `POST /api/v1/auth/verify-registration-code`

Redeems the 6-digit registration code and signs the user in. Public.
`authLimiter` (15m / 10).

| Field | Rules |
|---|---|
| `email` | string, ≤254, valid, normalized |
| `code` | string, exactly 6 digits |

**`200`**, `Set-Cookie` for both `tizello_access` and `tizello_refresh`.

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Account verified",
  "data": {
    "user": {
      "id": "cmtpakkau0000r2j2fvq8c44r",
      "name": "Ada Lovelace",
      "email": "ada@example.com",
      "emailVerified": true,
      "createdAt": "2026-09-06T04:08:27.846Z"
    }
  }
}
```

Same shape as `login/verify-code` (§6): dummy-hash burn when no code is
outstanding, the attempt cap checked and burned *before* the comparison, a
single-use consume on success. Redeeming the code sets `emailVerifiedAt` if it
was null and calls `issueSession` in the same step — there is no separate
"now log in" request, which is what this replaces the old link-plus-separate-
sign-in flow with.

**Errors**

| Status | When |
|---|---|
| `400` | Validation failed. |
| `401` | `CODE_INVALID` — wrong code, no outstanding code, or the attempt cap was hit. |
| `410` | `CODE_EXPIRED`. |
| `429` | `RATE_LIMITED`. |

---

## 3. `POST /api/v1/auth/resend-registration-code`

Re-sends a registration code. Public. `resendLimiter` (1h / 3).

| Field | Rules |
|---|---|
| `email` | string, ≤254, valid, normalized |

**`202`** — always, including for an address with no account or one already
verified, and always after the same elapsed time.

```json
{
  "success": true,
  "statusCode": 202,
  "message": "If that address has a pending verification, a code is on its way",
  "data": null
}
```

An already-verified address is silently ignored rather than re-sent to: otherwise
anyone could use this endpoint to mail a stranger on demand.

**Errors**

| Status | When |
|---|---|
| `400` | Validation failed. |
| `429` | `RATE_LIMITED`. The tightest budget in the module (3/hr) — this endpoint's only function is to send mail. |

---

## 4. `POST /api/v1/auth/login`

Password sign-in. Public. `authLimiter` (15m / 10).

| Field | Rules |
|---|---|
| `email` | string, ≤254, valid, normalized |
| `password` | string, ≤128 |

Note the asymmetry with §1: there is **no minimum length here**. A length rule on
a login field advertises the password policy and can reject a legacy password
that is still correct. Shape validation belongs where it changes what gets
stored.

**`200`** — plus `Set-Cookie` for both `tizello_access` and `tizello_refresh`.

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Signed in",
  "data": {
    "user": {
      "id": "cmtpakkau0000r2j2fvq8c44r",
      "name": "Ada Lovelace",
      "email": "ada@example.com",
      "emailVerified": true,
      "createdAt": "2026-09-06T04:08:27.846Z"
    }
  }
}
```

Tokens are **never in the body** — they are `httpOnly` cookies, which is what
keeps them out of reach of JavaScript. A `RefreshToken` row is inserted with a
fresh `familyId`, and the request's `userAgent` and `ip` are recorded on it for
incident forensics only; both are client-controlled strings and must never gate
an authorization decision.

**Errors**

| Status | When |
|---|---|
| `401` | `INVALID_CREDENTIALS` — wrong password, unknown address, **or an OAuth-only account with no password**. All three produce byte-identical responses and equal timing. See *Account enumeration*. |
| `403` | `EMAIL_NOT_VERIFIED` — checked only *after* the password matched. |
| `429` | `RATE_LIMITED`. |

---

## 5. `POST /api/v1/auth/login/request-code`

Issues a six-digit sign-in code. Public. `recoveryLimiter` (1h / 5).

| Field | Rules |
|---|---|
| `email` | string, ≤254, valid, normalized |

**This is the default sign-in path**, not a fallback. Spec §1: *"A code sent to
the address just typed cannot be forgotten, which deletes the single largest
cause of failed sign-ins rather than decorating it."* The frontend's two-step
form is built around it.

**`202`** — always, padded. Same envelope as §3.

Any outstanding code is consumed before a new one is issued, so exactly one live
code exists at a time.

**Errors**

| Status | When |
|---|---|
| `400` | Validation failed. |
| `429` | `RATE_LIMITED`. |

---

## 6. `POST /api/v1/auth/login/verify-code`

Redeems a login code and signs in. Public. `authLimiter` (15m / 10).

| Field | Rules |
|---|---|
| `email` | string, ≤254, valid, normalized |
| `code` | string matching `^[0-9]{6}$` |

`code` is a **string**, not a number. A numeric type accepts `4213` and strips the
leading zero from `004213`, silently turning a valid code into a wrong one.

**`200`** — plus both cookies. Body identical to §4.

Redeeming a code sets `emailVerifiedAt` if it was null: the code was delivered to
that address, which proves ownership exactly as a verification link does.

**Errors**

| Status | When |
|---|---|
| `401` | `CODE_INVALID` — wrong code, no outstanding code, unknown address, or the attempt cap already reached. A wrong guess increments `attempts` **on the row**. The cap is checked *before* the comparison, so the attempt that trips the limit cannot also be the one that succeeds. |
| `410` | `CODE_EXPIRED` — older than `LOGIN_CODE_TTL_MINUTES`; the code is burned. |
| `429` | `RATE_LIMITED`. |

---

## 7. `POST /api/v1/auth/forgot-password`

Mails a reset link. Public. `recoveryLimiter` (1h / 5).

| Field | Rules |
|---|---|
| `email` | string, ≤254, valid, normalized |

**`202`** — always, padded. Same envelope as §3.

An **OAuth-only account is silently skipped**. Sending a reset link to an account
that has no password would let anyone convert a Google-only account into a
password account — an account-takeover path dressed as a convenience.

**Errors**

| Status | When |
|---|---|
| `400` | Validation failed. |
| `429` | `RATE_LIMITED`. |

---

## 8. `POST /api/v1/auth/reset-password`

Sets a new password from a reset token. Public. `authLimiter` (15m / 10).

| Field | Rules |
|---|---|
| `token` | string, ≤200, required |
| `password` | string, 8–128 |

**`200`**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Password updated. Sign in with your new password.",
  "data": null
}
```

Two things this deliberately does **not** do:

- **It does not sign the user in.** Possession of an emailed link is not proof of
  identity (spec §6.4); they sign in afresh. Both cookies are *cleared*, because
  every session was just revoked and leaving a stale cookie only produces a
  confusing `401` on the next request.
- **It does not spare the current session.** Every refresh family for the user is
  revoked (spec §9). A reset that leaves the attacker's session alive has
  accomplished nothing, and "I changed my password" is precisely what a
  compromised user does first.

The new hash, the consumed token and the revocations are one transaction. A
partial apply is the worst outcome available: a changed password with live old
sessions reads as success and is not.

**Errors**

| Status | When |
|---|---|
| `400` | `TOKEN_INVALID` — unknown, already consumed, or minted for a different purpose. |
| `410` | `TOKEN_EXPIRED`. |
| `422` | `WEAK_PASSWORD`. |
| `429` | `RATE_LIMITED`. |

---

## 9. `POST /api/v1/auth/refresh`

Rotates the session. Public — **the cookie is the credential**. `refreshLimiter`
(15m / 60).

No request body, and no guard: the access token this renews is expected to be
expired by the time it is called.

**`200`** — plus a new `tizello_access` and a **different** `tizello_refresh`.
Body identical to §4, with `"message": "Session refreshed"`.

The full rotation, grace-window and reuse semantics are in *Refresh rotation and
reuse detection* above. In short: within 10 seconds a rotated token replays its
already-issued replacement (the tab race); outside it, the whole family dies.

**This route's path must stay byte-identical to `REFRESH_COOKIE_PATH` in
`shared/utils/cookies.js`.** They are two halves of one decision — rename either
alone and the browser stops attaching the token, so every session dies at its
first rotation, with no error anywhere to explain it.

**Errors**

| Status | When |
|---|---|
| `401` | `TOKEN_INVALID` — no cookie, unknown token, or **detected reuse**. All three are identical to the client: confirming that a token was once real is itself information. Cookies are cleared on every failure so the browser stops re-presenting a dead token. |
| `401` | `TOKEN_EXPIRED` — past `expiresAt` and never revoked. |
| `429` | `RATE_LIMITED`. |

---

## 10. `GET /api/v1/auth/session`

The current user. **`authGuard`.** No limiter.

**`200`**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Session",
  "data": {
    "user": {
      "id": "cmtpakkau0000r2j2fvq8c44r",
      "name": "Ada Lovelace",
      "email": "ada@example.com",
      "emailVerified": true,
      "createdAt": "2026-09-06T04:08:27.846Z"
    }
  }
}
```

The user row is re-read rather than reconstructed from the token's claims — see
*Caching*.

**Errors**

| Status | When |
|---|---|
| `401` | `TOKEN_INVALID` — absent, malformed or unverifiable token. |
| `401` | `TOKEN_EXPIRED` — the signal the frontend uses to decide to call `/refresh`. |

---

## 11. `POST /api/v1/auth/logout`

Ends the session. **No guard, no validator, never fails.**

**`204`**, with both cookies cleared — including for a caller with no cookies at
all. An error here strands a user in a session they cannot leave, which is the
whole reason the guard is absent.

**How it identifies the session, and why it is not the refresh cookie.** The
refresh cookie is scoped to `/api/v1/auth/refresh`, so a browser **never sends it
here**. Read literally, "revoke the presented refresh token's family" revokes
nothing: logout would clear the cookies, answer `204`, and leave a live refresh
token on the machine — a silent failure that looks exactly like success.

So the access token carries a `fid` claim naming its family, and logout verifies
that token **ignoring expiration** (the signature is still checked, so a forged
token is still refused) to learn which family to revoke. The three alternatives
were worse: widening the refresh cookie's path undoes the highest-value line in
the design; revoking every family signs the user out of every device; revoking
nothing is the bug. A non-browser client that *does* present the refresh token
directly is still honoured. Plan §4.4 records the correction.

**Errors** — none. Every input produces `204`.

---

## 12. `GET /api/v1/auth/:provider/start`

Begins an OAuth flow. `provider` ∈ `google | github`. Public. `oauthLimiter`
(15m / 20).

| Query | Rules |
|---|---|
| `next` | optional; a same-origin **relative** path |

**`302`** to the provider, carrying a signed `state`.

`next` travels *inside* the signed state, never as a query parameter, so it
cannot be tampered with — and it is still re-checked as a relative path on the
way out, because a signed open redirect is still an open redirect. `//evil.com`
is rejected along with `https://evil.com`: the protocol-relative form is the one
a naive "starts with `/`" check misses.

**Errors**

| Status | When |
|---|---|
| `404` | The provider has no credentials configured. Deliberate: a developer without Google keys must still be able to boot and work on password auth (plan §11), so absence is a normal state and its routes simply do not exist. |
| `429` | `RATE_LIMITED`. |

---

## 13. `GET /api/v1/auth/:provider/callback`

The provider's redirect target. Public. `oauthLimiter` (15m / 20).

**This is an OAuth redirect callback, not a webhook.** The user's *browser*
arrives by `GET` with `?code=…&state=…`, mid-navigation. There is no
provider-signed `POST` and no signature header, which is why the signed `state`
is the only thing making the request trustworthy: without it the callback accepts
any `code` an attacker can get delivered, and that is login-CSRF — the victim is
silently signed in to the **attacker's** account.

State is verified **before** Passport runs. Verifying afterwards would mean the
code had already been spent and the provider already contacted on an attacker's
behalf.

**`302`** to `${CLIENT_ORIGIN}${next}` with both cookies set. Never JSON: the
browser is rendering the response.

**The path carries no `/oauth` segment** — it is `/api/v1/auth/<provider>/callback`,
which is what is registered in the GitHub OAuth App and the Google console. A
provider compares the redirect URI character for character, so this string and
the console cannot disagree; between the two, the console is the side that cannot
be changed by a deploy. Plan §9 rows 12–13 record the correction.

**Errors** — all as a `302` to `/sign-in?error=<code>`:

| Code | When |
|---|---|
| `TOKEN_INVALID` | `state` missing, expired, tampered with, or not signed by us. |
| `OAUTH_EMAIL_UNVERIFIED` | The provider authenticated someone but would not vouch for the address. **Never linked.** If a provider let someone sign up as `victim@example.com` without proving it, linking on that claim hands over the victim's account. Google's flag is read from `profile._json.email_verified` (Passport's normalized `profile.emails[]` drops it) and compared explicitly, because Google returns the string `"true"` in some flows and every non-empty string — `"false"` included — is truthy. GitHub's requires a second call to `GET /user/emails` with the `user:email` scope; any failure of that call yields `false`, never an assumption. |
| `SERVER_ERROR` | Provider unreachable, or session issue failed. |

### Linking rules

```
OAuthAccount(provider, providerAccountId) exists?  → sign that user in
   else provider says email verified?
        no  → OAUTH_EMAIL_UNVERIFIED, do NOT link
        yes → User with that email exists?
                 yes → link: insert OAuthAccount → that user
                 no  → create User, emailVerifiedAt = now, passwordHash = null
```

**Lookup is by `(provider, providerAccountId)`, never by email.** A provider's
subject id is stable for the life of the account; an email address at that
provider can be changed, released and re-registered by someone else. Matching on
email would mean whoever holds an address today inherits the Tizello account of
whoever held it before. Email is used for exactly one thing — deciding whether a
*new* identity may link to an *existing* account — and only when the provider
states it is verified.

A brand-new OAuth user is created **already verified**: the provider vouched, and
asking them to prove an address they just authenticated with is theatre.

---

## Files

| Path | Holds |
|---|---|
| `src/modules/auth/auth.routes.js` | endpoints, middleware order |
| `src/modules/auth/auth.controller.js` | `req`/`res`, cookies, timing padding |
| `src/modules/auth/auth.service.js` | every business rule; throws `AppError` |
| `src/modules/auth/auth.oauth.service.js` | provider linking (§13) |
| `src/modules/auth/auth.oauth.controller.js` | start/callback, signed `state` |
| `src/modules/auth/auth.repository.js` | every Prisma call |
| `src/modules/auth/auth.dto.js` | `toUser` whitelist |
| `src/modules/auth/auth.validator.js` | Joi schemas; email normalization |
| `src/shared/utils/tokens.js` | signing, hashing, the SHA-256 vs bcrypt split |
| `src/shared/utils/cookies.js` | the two cookies and their attributes |
| `src/shared/utils/timing.js` | enumeration-safe response padding |
| `src/shared/constants/authCodes.js` | the closed `data.code` union |
| `src/shared/middlewares/rateLimiter.js` | Redis limiters, fail-closed |
| `src/config/passport.js` | strategy registration, per-provider verified flags |
