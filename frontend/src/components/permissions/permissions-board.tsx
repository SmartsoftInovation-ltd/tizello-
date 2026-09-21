"use client";

import { useState } from "react";
import { MemberRoleList } from "@/components/permissions/member-role-list";
import { PermissionMatrix } from "@/components/permissions/permission-matrix";
import { RoleCards } from "@/components/permissions/role-cards";
import { RoleDialog } from "@/components/permissions/role-dialog";
import { useRoles } from "@/components/permissions/use-roles";
import type { PermissionGroup, RoleDefinition, RoleInput } from "@/types/permissions";
import type { WorkspaceMember, WorkspaceRole } from "@/types/workspace";

/*
 * The screen's one client boundary: the roles, the matrix and the roster all
 * read the same state, so they sit under one leaf rather than three that would
 * have to be kept in sync. The page above stays a Server Component and hands
 * the fetched lists down as plain props.
 *
 * `editing` is `undefined` when the dialog is shut, `null` when it is open to
 * create, and a role when it is open to edit — one piece of state rather than
 * an open flag that can disagree with a target.
 *
 * THE DIALOG CLOSES ON SUCCESS, NOT ON SUBMIT. A write can be refused by the
 * server — a duplicate name, or a permission the author does not hold — and
 * closing optimistically would drop the draft while a toast explained a form
 * the reader can no longer see. `useRoles` takes an `onSuccess` callback for
 * exactly this, so the close is a consequence of the write landing rather than
 * an effect watching two flags fall.
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
  const {
    roles,
    assignments,
    memberCounts,
    error,
    clearError,
    isPending,
    createRole,
    updateRole,
    deleteRole,
    assignRole,
  } = useRoles(serverRoles, members, workspaceId);

  const [editing, setEditing] = useState<RoleDefinition | null | undefined>();

  const actionCount = groups.reduce(
    (total, group) => total + group.actions.length,
    0,
  );

  function closeDialog() {
    clearError();
    setEditing(undefined);
  }

  function submitRole(input: RoleInput) {
    if (editing) updateRole(editing.id, input, closeDialog);
    else createRole(input, closeDialog);
  }

  return (
    <>
      <RoleCards
        roles={roles}
        groups={groups}
        memberCounts={memberCounts}
        actionCount={actionCount}
        canManage={canManageRoles}
        onCreate={() => setEditing(null)}
        onEdit={(role) => setEditing(role)}
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

      {/* Mounted only while open, so the draft inside starts from `editing`
          without an effect copying props into state. */}
      {editing !== undefined && (
        <RoleDialog
          open
          onOpenChange={closeDialog}
          role={editing}
          groups={groups}
          error={error}
          pending={isPending}
          onSubmit={submitRole}
        />
      )}
    </>
  );
}
