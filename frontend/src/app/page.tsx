import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, HOME, REFRESH_COOKIE } from "@/lib/session-cookie";

/**
 * The entry point: nothing renders here, the visitor is sent on.
 *
 * Signed in they land on `HOME` (the workspace list, what the sidebar calls
 * Home); signed out, on `/sign-in`, which returns them to `HOME` once the
 * credential is proved. The design-system reference that used to occupy this
 * route now lives at `/design-system`.
 *
 * The check is cookie *presence* only — the same optimistic gate `proxy.ts`
 * makes, and for the same reason: this picks a destination, it does not
 * authorise a read, and `/workspaces` does the real `getSession()` check on
 * arrival. Calling the API from here would add a round trip to every visit to
 * `/`, and would refresh the access token inside a render — the rotation
 * hazard `lib/session-refresh.ts` describes.
 */
export default async function RootPage() {
  const store = await cookies();
  const signedIn = store.has(ACCESS_COOKIE) || store.has(REFRESH_COOKIE);

  redirect(signedIn ? HOME : "/sign-in");
}
