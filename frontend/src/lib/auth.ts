import { cookies } from "next/headers";
import { apiCall, apiCallWithRefresh } from "@/lib/api-client";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/session-cookie";
import { normaliseEmail } from "@/lib/validation/auth";
import type { AuthErrorCode, User } from "@/types/auth";

/*
 * The whole auth surface. Every function here is one endpoint from spec §9 and
 * keeps the signature it had as a fixture, so this cutover was "a change to this
 * file and nothing else" — the callers in `lib/actions/` are untouched.
 *
 * **The session is no longer ours to mint.** The fixture set a `tizello_session`
 * cookie holding a user id, which was fine when the id *was* the credential.
 * The API now issues `tizello_access` and `tizello_refresh`, both `httpOnly`,
 * and `api-client.ts` forwards them through. Nothing in this app invents,
 * signs or reads a session value any more — which is why the fixture's
 * `startSession` is gone rather than emptied: a function that exists to do
 * nothing invites someone to make it do something.
 *
 * This is the one module in `src/lib/` outside `lib/actions/` that imports
 * `next/*`: spec §10 puts the session read here so a Server Component can
 * `await getSession()` directly.
 */

export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; code: AuthErrorCode };

/** Narrows an API error code to the closed union the UI can render. */
export function asAuthError(code: string): AuthErrorCode {
  return (
    [
      "INVALID_CREDENTIALS",
      "EMAIL_TAKEN",
      "EMAIL_NOT_VERIFIED",
      "WEAK_PASSWORD",
      "CODE_INVALID",
      "CODE_EXPIRED",
      "TOKEN_INVALID",
      "TOKEN_EXPIRED",
      "RATE_LIMITED",
      "INVITE_EMAIL_MISMATCH",
      "SERVER_ERROR",
    ] as const
  ).includes(code as AuthErrorCode)
    ? (code as AuthErrorCode)
    : "SERVER_ERROR";
}

/* --- session ------------------------------------------------------------ */

/**
 * `GET /session`. Returns null rather than throwing — callers branch on it.
 *
 * Goes through `apiCallWithRefresh`, so a 15-minute access token that expired
 * while the user was reading a page is renewed transparently instead of
 * bouncing them to sign-in. Capped at one retry: see `api-client.ts`.
 */
export async function getSession(): Promise<User | null> {
  const result = await apiCallWithRefresh<{ user: User }>("/auth/session");

  return result.ok ? result.data.user : null;
}

/**
 * `POST /logout`. Revokes the refresh-token family server-side, and ONLY THEN
 * clears both cookies here.
 *
 * The cookies stay when the API does not confirm. Deleting them regardless
 * looked signed out on this machine while the refresh token was still live on
 * the server — anyone holding a copy could go on minting sessions. A failed
 * sign-out now says so and can be retried; the caller renders the `code`.
 */
export async function endSession(): Promise<{ ok: true } | { ok: false; code: string }> {
  const result = await apiCall("/auth/logout", { method: "POST", forwardCookies: true });
  if (!result.ok) return { ok: false, code: result.code };

  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  return { ok: true };
}

/* --- credentials -------------------------------------------------------- */

/**
 * `POST /register`. The account starts unverified; §15 treats that as a wall.
 *
 * `inviteToken` is the exception: a valid one proves the address, so the API
 * returns a verified account *and* a session, and the caller can go straight to
 * the workspace. A bad token is not an error — the account is still created.
 */
export async function register(input: {
  name: string;
  email: string;
  password: string;
  inviteToken?: string;
}): Promise<AuthResult & { inviteApplied?: boolean }> {
  const result = await apiCall<{ user: User; inviteApplied?: boolean }>(
    "/auth/register",
    {
      method: "POST",
      body: {
        name: input.name.trim(),
        email: normaliseEmail(input.email),
        password: input.password,
        ...(input.inviteToken ? { inviteToken: input.inviteToken } : {}),
      },
      forwardCookies: true,
    },
  );

  if (!result.ok) return { ok: false, code: asAuthError(result.code) };

  return { ok: true, user: result.data.user, inviteApplied: result.data.inviteApplied };
}

/**
 * `POST /login`. A wrong password and an unknown address return the *same*
 * code and take the same time — splitting them would turn this into an
 * enumeration oracle (spec §8). That parity is enforced on the server; this
 * function must not add a branch that reintroduces it.
 *
 * `inviteToken` stands in for email verification, and for nothing else: the API
 * checks the password first, then accepts the token as proof of the address it
 * was mailed to. It is what lets someone who registered before their invitation
 * arrived sign in at all — otherwise login refuses them as unverified and the
 * accept screen that would verify them sits behind the session login will not
 * issue. A token that does not name this address changes nothing.
 */
export async function login(input: {
  email: string;
  password: string;
  inviteToken?: string;
}): Promise<AuthResult> {
  const result = await apiCall<{ user: User }>("/auth/login", {
    method: "POST",
    body: {
      email: normaliseEmail(input.email),
      password: input.password,
      ...(input.inviteToken ? { inviteToken: input.inviteToken } : {}),
    },
    forwardCookies: true,
  });

  return result.ok
    ? { ok: true, user: result.data.user }
    : { ok: false, code: asAuthError(result.code) };
}

/**
 * `POST /login/request-code`. Always resolves, known address or not — the
 * response carries no signal, and the server pads its timing to match.
 */
export async function requestLoginCode(rawEmail: string): Promise<void> {
  await apiCall("/auth/login/request-code", {
    method: "POST",
    body: { email: normaliseEmail(rawEmail) },
  });
}

/** `POST /login/verify-code`. Single-use; a used or stale code is burned. */
export async function verifyLoginCode(input: {
  email: string;
  code: string;
}): Promise<AuthResult> {
  const result = await apiCall<{ user: User }>("/auth/login/verify-code", {
    method: "POST",
    body: { email: normaliseEmail(input.email), code: input.code },
    forwardCookies: true,
  });

  return result.ok
    ? { ok: true, user: result.data.user }
    : { ok: false, code: asAuthError(result.code) };
}
