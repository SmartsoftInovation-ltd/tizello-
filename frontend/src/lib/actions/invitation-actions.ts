"use server";

import { revalidatePath } from "next/cache";
import {
  acceptInvitation,
  createInvitation,
  declineInvitation,
  resendInvitation,
  revokeInvitation,
} from "@/lib/invites";
import { rememberWorkspaceOnServer } from "@/lib/actions/remember-workspace";
import { normaliseEmail, validateEmail } from "@/lib/validation/auth";
import type { InvitableRole } from "@/types/workspace";

/*
 * Every invitation write. Thin by rule: validate, call a plain function from
 * `lib/invites.ts`, revalidate. The rules themselves live on the server —
 * whether the caller may invite, whether the address is already a member,
 * whether a live invitation exists — and are documented in
 * `backend/docs/api/invitation.md`.
 *
 * **Each action returns a plain serialisable result rather than throwing.**
 * These are called from client leaves that render the outcome inline or as a
 * toast; a thrown error there produces an error boundary and loses the form.
 *
 * The `code` that comes back is the API's `data.code`, which the caller maps to
 * copy. Nothing here forwards a server *message* to the UI — that is the rule
 * the whole closed-union error contract rests on.
 */

export type ActionResult = { ok: true } | { ok: false; code: string };

export async function inviteMemberAction(input: {
  workspaceId: string;
  email: string;
  role: InvitableRole;
}): Promise<ActionResult> {
  const email = normaliseEmail(input.email);

  /* Re-validated here even though the dialog checks it too. The client-side
     rule is a convenience; this is the control (spec §7). */
  if (validateEmail(email)) return { ok: false, code: "VALIDATION_ERROR" };

  /* OWNER is not an invitable role — ownership is transferred, never granted by
     invitation. The API rejects it at its validator AND in its service; this is
     the third layer, and it is here so a tampered client payload never even
     leaves the app. */
  if (input.role !== "ADMIN" && input.role !== "MEMBER") {
    return { ok: false, code: "VALIDATION_ERROR" };
  }

  const result = await createInvitation({ ...input, email });

  if (!result.ok) return result;

  revalidatePath(`/workspaces/${input.workspaceId}/members`);
  return { ok: true };
}

export async function revokeInvitationAction(
  workspaceId: string,
  invitationId: string,
): Promise<ActionResult> {
  const ok = await revokeInvitation(workspaceId, invitationId);

  if (!ok) return { ok: false, code: "NOT_FOUND" };

  revalidatePath(`/workspaces/${workspaceId}/members`);
  return { ok: true };
}

/**
 * Resend rotates the token server-side, so the previous link stops working.
 * No revalidate: nothing the members screen renders changes — the row is still
 * pending, by the same person, for the same address.
 */
export async function resendInvitationAction(
  workspaceId: string,
  invitationId: string,
): Promise<ActionResult> {
  const ok = await resendInvitation(workspaceId, invitationId);

  return ok ? { ok: true } : { ok: false, code: "NOT_FOUND" };
}

/**
 * Accepting is idempotent on the API, so a double-click returns `200` twice and
 * leaves one membership. This action therefore has no "already accepted" branch
 * to render — success covers both.
 */
export async function acceptInvitationAction(
  token: string,
): Promise<{ ok: true; workspaceId: string } | { ok: false; code: string }> {
  const result = await acceptInvitation(token);

  if (!result.ok) return result;

  /* Joining a workspace makes it the open one, so the sidebar and the board
     screens start there rather than wherever the cookie last pointed. */
  await rememberWorkspaceOnServer(result.workspaceId);

  /* The new workspace appears in the switcher and the list, neither of which is
     on this route — revalidate the layout so both are rebuilt. */
  revalidatePath("/workspaces", "layout");
  return result;
}

export async function declineInvitationAction(token: string): Promise<ActionResult> {
  const ok = await declineInvitation(token);

  return ok ? { ok: true } : { ok: false, code: "NOT_FOUND" };
}
