"use server";

import { revalidatePath } from "next/cache";
import { removeMember, updateMemberRole, type BlockingProject } from "@/lib/members";
import type { WorkspaceMember, WorkspaceRole } from "@/types/workspace";

/*
 * Every member write. Thin by rule: validate, call a plain function from
 * `lib/members.ts`, revalidate. The rules themselves live on the server — who
 * may change a role, that the owner is untouchable, that you cannot act on your
 * own row, that a project owner cannot be removed — and are documented in
 * `backend/docs/api/member.md`.
 *
 * **Each action returns a plain serialisable result rather than throwing.** These
 * are called from client leaves that render the outcome as a toast; a thrown
 * error there produces an error boundary and loses the roster the user was
 * looking at.
 *
 * Both actions revalidate `/workspaces/:id/members`, which is what makes a
 * change survive a reload. The calling leaf also updates its own copy of the
 * roster, which is what makes it immediate — see `use-member-mutations.ts`.
 * The permissions screen reads the same roster, so it is revalidated too: a
 * role changed on one of the two screens must not leave the other showing the
 * old chip.
 */

export type MemberActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: string; projects?: BlockingProject[] };

function revalidateMemberSurfaces(workspaceId: string): void {
  revalidatePath(`/workspaces/${workspaceId}/members`);
  revalidatePath(`/workspaces/${workspaceId}/settings/permissions`);
}

/**
 * `PATCH .../members/:memberId`.
 *
 * OWNER is rejected here as well as at the API's validator and in its service.
 * This is the third layer, and it is here so a tampered client payload never
 * even leaves the app: *ownership is transferred, never granted*. The same
 * three-layer arrangement `inviteMemberAction` uses for the same value.
 */
export async function updateMemberRoleAction(
  input: { workspaceId: string; memberId: string } & (
    | { role: WorkspaceRole; roleId?: never }
    | { roleId: string; role?: never }
  ),
): Promise<MemberActionResult<WorkspaceMember>> {
  /* A tier, if one was sent, must not be OWNER. A `roleId` needs no check
     here: the server refuses a role whose `baseRole` is OWNER, and a workspace
     cannot create one in the first place — the validator's list omits it. */
  if (input.role !== undefined && input.role !== "ADMIN" && input.role !== "MEMBER") {
    return { ok: false, code: "VALIDATION_ERROR" };
  }

  const assignment =
    input.roleId !== undefined
      ? { roleId: input.roleId }
      : { role: input.role as WorkspaceRole };

  const result = await updateMemberRole(input.workspaceId, input.memberId, assignment);

  if (!result.ok) return result;

  revalidateMemberSurfaces(input.workspaceId);
  return result;
}

/**
 * `DELETE .../members/:memberId`.
 *
 * Not idempotent, by the API's decision: a second call answers `404`, because a
 * membership id is not a stable handle for a person. So the caller must not
 * retry this on failure — `NOT_FOUND` here means the row is already gone, not
 * that the request was lost.
 *
 * A `409` carries the projects that block it; they are passed straight through
 * for the toast to name.
 */
export async function removeMemberAction(
  workspaceId: string,
  memberId: string,
): Promise<MemberActionResult> {
  const result = await removeMember(workspaceId, memberId);

  if (!result.ok) return result;

  revalidateMemberSurfaces(workspaceId);
  return result;
}
