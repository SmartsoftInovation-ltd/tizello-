import { cookies } from "next/headers";
import { WORKSPACE_COOKIE, WORKSPACE_COOKIE_MAX_AGE } from "@/lib/active-workspace";

/**
 * Server-side twin of `rememberWorkspace` in `lib/active-workspace.ts`: makes
 * `workspaceId` the open workspace for this browser.
 *
 * Called when an invitation is accepted, so someone invited to Tizaraa lands
 * in Tizaraa after signing in instead of on an unselected switcher. Set from
 * the action rather than the client because the sign-up path redirects before
 * any client code runs.
 *
 * Not `httpOnly` — the client reads the same cookie (`readStoredWorkspace`).
 * Its own module, not inside an action file, because a `"use server"` file may
 * export only async actions.
 */
export async function rememberWorkspaceOnServer(workspaceId: string) {
  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, {
    path: "/",
    maxAge: WORKSPACE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
}
