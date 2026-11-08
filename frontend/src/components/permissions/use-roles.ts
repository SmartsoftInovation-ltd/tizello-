"use client";

import { useMemo, useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { useRoleAssignment } from "@/components/permissions/use-role-assignment";
import { deleteRoleAction } from "@/lib/actions/role-actions";
import { roleErrorCopy, type RoleDefinition } from "@/types/permissions";
import type { WorkspaceMember } from "@/types/workspace";

/*
 * Everything this screen can change, in one place: the role list, who holds
 * which role, and the pending state both share.
 *
 * **BOTH HALVES ARE REAL NOW.** Defining a role was fixture `useState` for as
 * long as the API had three roles and no endpoint for a fourth. It has
 * `workspace_roles` and full CRUD, so every function below is a Server Action
 * that revalidates this route — a role created here survives a reload, and the
 * permissions it grants are the ones `requirePermission` gates on.
 *
 * CREATE AND EDIT ARE NOT HERE. They moved to the role editor page
 * (`RoleForm`), which calls the Server Actions itself and navigates back on
 * success — the revalidation brings the new list to this screen.
 *
 * `roles` is a PROP, not state. The server list is the truth after every write
 * (the actions revalidate), and `useOptimistic` covers the gap between the
 * click and the revalidation. Keeping a `useState` copy beside it would be a
 * second truth that drifts the moment a write fails.
 */

/** Only a delete is optimistic here now — see the header. */
function applyOptimistic(roles: RoleDefinition[], deletedId: string): RoleDefinition[] {
  return roles.filter((role) => role.id !== deletedId);
}

export function useRoles(
  serverRoles: RoleDefinition[],
  members: WorkspaceMember[],
  workspaceId: string,
) {
  const [roles, addOptimistic] = useOptimistic(serverRoles, applyOptimistic);
  const [isPending, startTransition] = useTransition();

  const { assignments, assignRole, isPending: assigning } = useRoleAssignment(
    members,
    roles,
    workspaceId,
  );

  /* Derived, never authored: a card cannot quote a count the roster disagrees
     with, and a member reassigned below updates both at once. The server's own
     `memberCount` seeds nothing here — it would be stale the moment someone is
     reassigned without a reload. */
  const memberCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const roleId of Object.values(assignments)) {
      counts[roleId] = (counts[roleId] ?? 0) + 1;
    }
    return counts;
  }, [assignments]);

  function deleteRole(role: RoleDefinition): void {
    startTransition(async () => {
      addOptimistic(role.id);

      const result = await deleteRoleAction(workspaceId, role.id);

      if (!result.ok) {
        /* The common refusal is `CONFLICT` — somebody still holds it. The copy
           says so, because "something went wrong" would send the reader
           looking for a bug instead of reassigning a member. */
        toast.error(roleErrorCopy(result.code));
        return;
      }

      toast.success(`${role.name} deleted`);
    });
  }

  return {
    roles,
    assignments,
    memberCounts,
    isPending: isPending || assigning,
    deleteRole,
    assignRole,
  };
}
