"use client";

import { useRouter } from "next/navigation";
import { MemberRoleList } from "@/components/permissions/member-role-list";
import { PermissionMatrix } from "@/components/permissions/permission-matrix";
import { RoleCards } from "@/components/permissions/role-cards";
import { useRoles } from "@/components/permissions/use-roles";
import { editRoleHref, newRoleHref } from "@/lib/role-paths";
import type { PermissionGroup, RoleDefinition } from "@/types/permissions";
import type { WorkspaceMember, WorkspaceRole } from "@/types/workspace";

/*
 * The screen's one client boundary: the roles, the matrix and the roster all
 * read the same state, so they sit under one leaf rather than three that would
 * have to be kept in sync. The page above stays a Server Component and hands
 * the fetched lists down as plain props.
 *
 * CREATING AND EDITING A ROLE ARE PAGES, not a dialog here
 * (`settings/permissions/roles/new` and `.../roles/[roleId]`, `RoleForm`). The
 * editor outgrew a modal once every permission carried an explanation; the
 * cards below only navigate to it.
 */
export function PermissionsBoard({
  groups,
  roles: serverRoles,
  members,
  currentUserId,
  viewerRole,
  canManageRoles,
  workspaceId,
}: {
  groups: PermissionGroup[];
  roles: RoleDefinition[];
  members: WorkspaceMember[];
  currentUserId: string;
  /** The signed-in user's own tier here — what decides whether the role selects are live. */
  viewerRole: WorkspaceRole;
  /** Whether they hold `roles.manage`. The server enforces; this only draws. */
  canManageRoles: boolean;
  workspaceId: string;
}) {
  const router = useRouter();
  const { roles, assignments, memberCounts, deleteRole, assignRole } = useRoles(
    serverRoles,
    members,
    workspaceId,
  );

  const actionCount = groups.reduce(
    (total, group) => total + group.actions.length,
    0,
  );

  return (
    <>
      <RoleCards
        roles={roles}
        groups={groups}
        memberCounts={memberCounts}
        actionCount={actionCount}
        canManage={canManageRoles}
        onCreate={() => router.push(newRoleHref(workspaceId))}
        onEdit={(role: RoleDefinition) => router.push(editRoleHref(workspaceId, role.id))}
        onDelete={deleteRole}
      />

      <PermissionMatrix groups={groups} roles={roles} />

      <MemberRoleList
        members={members}
        roles={roles}
        assignments={assignments}
        currentUserId={currentUserId}
        viewerRole={viewerRole}
        onAssign={assignRole}
      />

    </>
  );
}
