"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRoleAssignment } from "@/components/permissions/use-role-assignment";
import {
  createRoleAction,
  deleteRoleAction,
  updateRoleAction,
} from "@/lib/actions/role-actions";
import { roleErrorCopy, type RoleDefinition, type RoleInput } from "@/types/permissions";
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
 * `createRole` and `updateRole` take an `onSuccess` callback rather than
 * returning a promise, and the caller uses it to close the dialog. A dialog
 * that closed on SUBMIT would drop the draft whenever the server refused the
 * write — a duplicate name, or a permission the author does not hold — leaving
 * a toast explaining a form the reader can no longer see. Watching `isPending`
 * fall from an effect was the other option; React's own rule against
 * `setState` in an effect is the reason this is a callback instead.
 *
 * `roles` is a PROP, not state. The server list is the truth after every write
 * (the actions revalidate), and `useOptimistic` covers the gap between the
 * click and the revalidation. Keeping a `useState` copy beside it would be a
 * second truth that drifts the moment a write fails.
 */

type Optimistic =
  | { kind: "create"; role: RoleDefinition }
  | { kind: "update"; id: string; input: Partial<RoleInput> }
  | { kind: "delete"; id: string };

function applyOptimistic(roles: RoleDefinition[], change: Optimistic): RoleDefinition[] {
  if (change.kind === "create") return [...roles, change.role];
  if (change.kind === "delete") return roles.filter((role) => role.id !== change.id);

  return roles.map((role) =>
    role.id === change.id
      ? {
          ...role,
          ...(change.input.name ? { name: change.input.name } : {}),
          ...(change.input.baseRole ? { baseRole: change.input.baseRole } : {}),
          ...(change.input.permissions ? { permissions: change.input.permissions } : {}),
        }
      : role,
  );
}

export function useRoles(
  serverRoles: RoleDefinition[],
  members: WorkspaceMember[],
  workspaceId: string,
) {
  const [roles, addOptimistic] = useOptimistic(serverRoles, applyOptimistic);
  const [isPending, startTransition] = useTransition();
  /* The last write's error, for the dialog to render inline. A toast alone
     leaves a rejected form looking as though it saved. */
  const [error, setError] = useState<string | undefined>();

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

  function createRole(input: RoleInput, onSuccess?: () => void): void {
    setError(undefined);
    startTransition(async () => {
      /* A placeholder id that cannot collide with a cuid, replaced the moment
         the route revalidates. */
      addOptimistic({
        kind: "create",
        role: { id: `pending-${Date.now()}`, builtIn: false, ...input },
      });

      const result = await createRoleAction(workspaceId, input);

      if (!result.ok) {
        setError(roleErrorCopy(result.code));
        toast.error(roleErrorCopy(result.code));
        return;
      }

      toast.success(`${result.data.name} created`);
      onSuccess?.();
    });
  }

  function updateRole(id: string, input: RoleInput, onSuccess?: () => void): void {
    setError(undefined);
    startTransition(async () => {
      addOptimistic({ kind: "update", id, input });

      const result = await updateRoleAction(workspaceId, id, input);

      if (!result.ok) {
        setError(roleErrorCopy(result.code));
        toast.error(roleErrorCopy(result.code));
        return;
      }

      toast.success(`${result.data.name} saved`);
      onSuccess?.();
    });
  }

  function deleteRole(role: RoleDefinition): void {
    startTransition(async () => {
      addOptimistic({ kind: "delete", id: role.id });

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
    error,
    clearError: () => setError(undefined),
    isPending: isPending || assigning,
    createRole,
    updateRole,
    deleteRole,
    assignRole,
  };
}
