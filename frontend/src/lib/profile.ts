import { apiCallWithRefresh } from "@/lib/api-client";
import type { Profile, ProfileInput } from "@/types/profile";

/*
 * The profile API — `backend/docs/api/user.md`.
 *
 * Two endpoints, both `/users/me`, both about the signed-in account and nobody
 * else. There is deliberately no `getProfile(id)`: the API has no `/users/:id`,
 * because a profile is edited only by the person it belongs to and the identity
 * comes from the token rather than a path. Reading another member's display
 * fields is the workspace roster's job (`lib/members.ts`).
 *
 * **Email is not here.** It is the login identity and the address an invitation
 * is bound to; changing it is a flow with its own tokens, not a field on a
 * form. The API refuses the key rather than ignoring it, so sending one is a
 * `400` — which is why nothing below can construct a body containing it.
 */

export type ProfileResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: string };

/** `GET /users/me`. Null when there is no session, or the row is gone. */
export async function getProfile(): Promise<Profile | null> {
  const result = await apiCallWithRefresh<{ profile: Profile }>("/users/me");

  return result.ok ? result.data.profile : null;
}

/**
 * `PATCH /users/me`.
 *
 * The caller decides what is in `input`, and an omitted key is not the same as
 * `null`: omitted leaves the stored value alone, `null` clears it. That
 * distinction survives `JSON.stringify` — an `undefined` value is dropped from
 * the payload entirely, which is exactly the "leave it alone" the API reads.
 */
export async function updateProfile(
  input: ProfileInput,
): Promise<ProfileResult<Profile>> {
  const result = await apiCallWithRefresh<{ profile: Profile }>("/users/me", {
    method: "PATCH",
    body: input,
    forwardCookies: true,
  });

  return result.ok
    ? { ok: true, data: result.data.profile }
    : { ok: false, code: result.code };
}
