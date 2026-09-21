import { apiCallWithRefresh } from "@/lib/api-client";
import { sortMembers } from "@/lib/member-sort";
import { getWorkspaceMembers, type WorkspaceMemberRow } from "@/lib/workspaces";
import type { WorkspaceMember, WorkspaceRole } from "@/types/workspace";

/*
 * The member API — `backend/docs/api/member.md`. Replaces `demo-members.ts`.
 *
 * Three endpoints, all under `/workspaces/:workspaceId/members`, and
 * **deliberately no create**: the only way into a workspace is an invitation the
 * recipient accepts (`lib/invites.ts`, `backend/docs/api/invitation.md`). The
 * API has no `POST /members` to call — one taking a `userId` would put somebody
 * in a workspace without their consent, and would need a
 * user-lookup-by-email endpoint to be usable at all.
 *
 * The READ is not re-implemented here. `getWorkspaceMembers` in
 * `lib/workspaces.ts` already calls `GET .../members` for the project screens,
 * which want the raw row; this file maps that row to the `WorkspaceMember` the
 * roster renders. One fetch, two shapes — a second `fetch` of the same path
 * would be a second place to fix when the endpoint changes.
 */

export type MemberResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: string; projects?: BlockingProject[] };

/**
 * A project that blocks a removal, from the `409`'s
 * `data.details.projects` (member.md §3).
 *
 * Named for the role it plays rather than mirroring the API field, because the
 * only thing this app does with it is explain why the removal was refused.
 */
export type BlockingProject = { id: string; name: string; key: string };

/**
 * The roster row → the type every member surface renders.
 *
 * **`name` falls back to the address's local part.** The API returns
 * `user.name: string | null` — an account created by accepting an invitation
 * has never been asked for a name — while `WorkspaceMember.name` is a
 * `string`, because `MemberIdentity` draws initials from it and
 * `sortMembers` compares it. "j.ferreira" is a worse label than "Jonah
 * Ferreira" and a far better one than an empty disc next to a blank row.
 */
function toMember(row: WorkspaceMemberRow): WorkspaceMember {
  const email = row.user?.email ?? "";

  return {
    id: row.id,
    userId: row.userId,
    name: row.user?.name?.trim() || email.split("@")[0] || "Unknown",
    email,
    role: row.role,
    roleId: row.roleId ?? null,
    roleName: row.roleName ?? null,
  };
}

/**
 * `GET /workspaces/:id/members`, shaped for the roster.
 *
 * Returns `[]` on failure, including the `404` a non-member gets: every caller
 * has already resolved the workspace (and would have hit `notFound()` if it
 * were not theirs), so a failure here is an empty list rather than a thrown
 * page.
 */
export async function getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  if (!workspaceId) return [];

  const rows = await getWorkspaceMembers(workspaceId);

  return sortMembers(rows.map(toMember));
}

/**
 * `PATCH /workspaces/:id/members/:memberId`.
 *
 * `:memberId` is the MEMBERSHIP id, not the user id — see `WorkspaceMember`.
 *
 * The API returns the whole roster row so the caller can replace one row in
 * place instead of refetching the list, and this passes that through rather
 * than echoing the role that was requested: if the server ever disagreed with
 * the optimistic value, the server is right.
 */
export async function updateMemberRole(
  workspaceId: string,
  memberId: string,
  /* EXACTLY ONE of the two. `role` sets the tier directly and clears any
     custom role; `roleId` names a workspace-defined one, and the server takes
     the tier from that role's own `baseRole`. The API's validator is `.xor`, so
     sending both is a 400 rather than a quiet precedence rule. */
  assignment: { role: WorkspaceRole } | { roleId: string },
): Promise<MemberResult<WorkspaceMember>> {
  const result = await apiCallWithRefresh<{ member: WorkspaceMemberRow }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(memberId)}`,
    { method: "PATCH", body: assignment },
  );

  return result.ok
    ? { ok: true, data: toMember(result.data.member) }
    : { ok: false, code: result.code };
}

/**
 * `DELETE /workspaces/:id/members/:memberId`.
 *
 * The one failure this app reads detail out of is the `409`: a member who owns
 * projects in the workspace cannot be removed, and the response names them so
 * the toast can say *which three to transfer first* rather than "something went
 * wrong". Everything else is a bare code.
 */
export async function removeMember(
  workspaceId: string,
  memberId: string,
): Promise<MemberResult> {
  const result = await apiCallWithRefresh(
    `/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(memberId)}`,
    { method: "DELETE" },
  );

  if (result.ok) return { ok: true, data: undefined };

  return { ok: false, code: result.code, projects: blockingProjects(result.details) };
}

/**
 * Narrows the `409`'s `details` to the project list.
 *
 * `unknown` in, because `details` is whatever the wire sent — and on this
 * endpoint it is an object, where every other module's `details` is Joi's
 * `[{ field, message }]` array. That divergence is documented in member.md §3;
 * `fieldErrorsFrom` is the array case and deliberately not reused here.
 */
function blockingProjects(details: unknown): BlockingProject[] | undefined {
  if (!details || typeof details !== "object" || !("projects" in details)) return undefined;

  const { projects } = details as { projects: unknown };
  if (!Array.isArray(projects)) return undefined;

  const rows = projects.filter(
    (entry): entry is BlockingProject =>
      !!entry &&
      typeof entry === "object" &&
      typeof (entry as BlockingProject).id === "string" &&
      typeof (entry as BlockingProject).name === "string",
  );

  return rows.length > 0 ? rows : undefined;
}
