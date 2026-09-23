import { uploadUrl } from "@/lib/uploads";

/*
 * How a person is SHOWN: their name, and the URL of their photo.
 *
 * SPLIT OUT OF `lib/profile.ts` BECAUSE CLIENT COMPONENTS NEED IT. That file
 * talks to the API through `lib/api-client.ts`, which imports `next/headers`
 * to read the session cookie — server-only. A client component importing
 * `displayName` from there pulled the whole chain into the browser bundle and
 * failed the build outright ("You're importing a module that depends on
 * next/headers"), which is the good version of that mistake: the bad version
 * is a module that merely ships the wrong code to the browser and works.
 *
 * Everything here is pure. No fetch, no cookies, no `next/*`.
 */

/**
 * The public URL of a profile photo, or `null`.
 *
 * The stored value is a path (`/uploads/<uuid>.png`), not a URL: the origin
 * differs per environment, so storing one would pin the row to a deploy. This
 * strips the leading segment and hands the stored name to `uploadUrl`, which
 * re-checks its shape and joins it onto `NEXT_PUBLIC_UPLOADS_URL`.
 */
export function avatarSrc(avatarUrl: string | null): string | null {
  if (!avatarUrl) return null;

  const storedName = avatarUrl.replace(/^\/uploads\//, "");

  return uploadUrl(storedName);
}

/**
 * What to call someone, in one place.
 *
 * Nickname first — it is the name a person chose for themselves, which is the
 * point of having the field. Then the full name, then the address's local part,
 * which is what an account created by accepting an invitation has until it sets
 * one. `lib/members.ts` makes the same fallback for the same reason; the
 * difference is that this one also knows about nicknames.
 */
export function displayName(profile: {
  nickname: string | null;
  name: string | null;
  email: string;
}): string {
  return (
    profile.nickname?.trim() ||
    profile.name?.trim() ||
    profile.email.split("@")[0]
  );
}
