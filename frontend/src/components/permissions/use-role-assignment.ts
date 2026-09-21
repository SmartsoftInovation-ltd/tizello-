"use client";

import { useState, useTransition } from "react";
import { updateMemberRoleAction } from "@/lib/actions/member-actions";
import { memberErrorCopy } from "@/lib/member-error-copy";
import { toast } from "sonner";
import type { RoleDefinition } from "@/types/permissions";
import type { WorkspaceMember } from "@/types/workspace";

/*
 * Who holds which role.
 *
 * **A custom role can be assigned now.** This file used to refuse one with a
 * sentence, because `role-reviewer` existed on this screen and nowhere on the
 * server. Roles are rows in `workspace_roles`, so the assignment is
 * `PATCH .../members/:memberId` with `{ roleId }` — and the API writes both
 * columns from it: `roleId` decides the grant, `role` follows the role's own
 * `baseRole` so `roleAtLeast` keeps working.
 *
 * A BUILT-IN is still sent as `{ role }`, not `{ roleId }`. The two are
 * mutually exclusive at the validator, and sending the tier directly is what
 * CLEARS any custom role the member held — assigning "Member" has to mean
 * "back to the plain tier", not "the row named Member plus whatever it
 * happens to grant".
 *
 * Ownership is the one refusal left: it is transferred, never granted.
 */

const OWNER_REFUSAL = "Ownership is transferred, not assigned as a role.";

export function useRoleAssignment(
  members: WorkspaceMember[],
  roles: RoleDefinition[],
  workspaceId: string,
) {
  /* Member id → role id. Seeded from the roster the server sent: a member
     holding a custom role carries its id, one on a plain tier carries the tier
     string, and the role list contains both kinds of id. */
  const [assignments, setAssignments] = useState<Record<string, string>>(() =>
    Object.fromEntries(members.map((member) => [member.id, member.roleId ?? member.role])),
  );
  const [isPending, startTransition] = useTransition();

  function assignRole(member: WorkspaceMember, role: RoleDefinition) {
    if (assignments[member.id] === role.id) return;

    if (role.baseRole === "OWNER") {
      toast.error(OWNER_REFUSAL);
      return;
    }

    const previous = assignments[member.id] ?? member.roleId ?? member.role;
    setAssignments((current) => ({ ...current, [member.id]: role.id }));

    startTransition(async () => {
      const result = await updateMemberRoleAction({
        workspaceId,
        memberId: member.id,
        /* Built-in → the tier, which clears any custom role. Custom → the id,
           and the server derives the tier from it. `.xor` at the validator
           means exactly one of these may be present. */
        ...(role.builtIn ? { role: role.baseRole } : { roleId: role.id }),
      });

      if (!result.ok) {
        /* Back to the value captured before the optimistic write. The role
           cards' counts are derived from this map, so a failed write that left
           it alone would also leave a count one too high. */
        setAssignments((current) => ({ ...current, [member.id]: previous }));
        toast.error(memberErrorCopy(result.code));
        return;
      }

      toast.success(`${member.name} is now ${role.name}`);
    });
  }

  /** Which role a member holds, as a role id the list can match. */
  function heldBy(member: WorkspaceMember): string {
    return assignments[member.id] ?? member.roleId ?? member.role;
  }

  return { assignments, assignRole, heldBy, isPending, roles };
}
