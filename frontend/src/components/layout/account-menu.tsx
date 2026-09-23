import { AccountMenuTrigger } from "@/components/layout/account-menu-trigger";
import { getProfile } from "@/lib/profile";
import { avatarSrc, displayName } from "@/lib/profile-display";

/**
 * Replaces `SidebarAccount`, which pinned this to the sidebar's bottom edge —
 * now it sits in `ContentStrip`, beside `ThemeToggle`, per the reference
 * layout.
 *
 * **`getProfile()` rather than `getSession()`.** Both prove the session; only
 * one carries the nickname and the photo, which are the two things this control
 * draws. The session shape (`toUser` on the API) deliberately stays five
 * fields, so it does not have them — see `backend/docs/api/user.md`.
 *
 * That makes this one extra request per page render. It is the same round-trip
 * `getSession()` was already making, to a neighbouring endpoint, and it is
 * `no-store` either way; what it buys is that the name beside a sign-out
 * control is the name that account chose for itself.
 */
export async function AccountMenu() {
  const profile = await getProfile();
  if (!profile) return null;

  return (
    <AccountMenuTrigger
      name={displayName(profile)}
      avatarSrc={avatarSrc(profile.avatarUrl)}
    />
  );
}
