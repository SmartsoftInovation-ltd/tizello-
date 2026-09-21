"use server";

import { revalidatePath } from "next/cache";
import { createRole, deleteRole, updateRole } from "@/lib/workspace-roles";
import type { RoleDefinition, RoleInput } from "@/types/permissions";

/*
 * Every workspace-role write. Thin by rule: call a plain function from
 * `lib/roles.ts`, revalidate, return a code the dialog renders.
 *
 * **The rules are not re-implemented here.** That a built-in cannot be edited,
 * that a role cannot grant more than its author holds, that a role in use
 * cannot be deleted — all of that is enforced in
 * `backend/src/modules/role/role.service.js`, which is reachable from a worker
 * or a script and is therefore the only place worth enforcing it. This layer
 * exists to revalidate and to keep a thrown error out of a client leaf.
 *
 * Each action returns a plain serialisable result rather than throwing: these
 * are called from a client leaf that renders the outcome as a toast, and a
 * throw there produces an error boundary and loses the screen.
 */

export type RoleActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: string };

/* Roles decide what the roster may do, so both surfaces are revalidated: a
   role edited here must not leave the members screen drawing the old grid. */
function revalidateRoleSurfaces(workspaceId: string): void {
  revalidatePath(`/workspaces/${workspaceId}/settings/permissions`);
  revalidatePath(`/workspaces/${workspaceId}/members`);
}

export async function createRoleAction(
  workspaceId: string,
  input: RoleInput,
): Promise<RoleActionResult<RoleDefinition>> {
  const result = await createRole(workspaceId, input);
  if (!result.ok) return result;

  revalidateRoleSurfaces(workspaceId);
  return result;
}

export async function updateRoleAction(
  workspaceId: string,
  roleId: string,
  input: Partial<RoleInput>,
): Promise<RoleActionResult<RoleDefinition>> {
  const result = await updateRole(workspaceId, roleId, input);
  if (!result.ok) return result;

  revalidateRoleSurfaces(workspaceId);
  return result;
}

export async function deleteRoleAction(
  workspaceId: string,
  roleId: string,
): Promise<RoleActionResult> {
  const result = await deleteRole(workspaceId, roleId);
  if (!result.ok) return result;

  revalidateRoleSurfaces(workspaceId);
  return result;
}
