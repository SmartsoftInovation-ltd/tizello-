/*
 * The URLs of the roles screens, built in one place. The permissions page links
 * to the editor and the editor sends people back, so a path spelled out in both
 * would be two places for a renamed segment to break one direction only.
 */
export const permissionsHref = (workspaceId: string) =>
  `/workspaces/${workspaceId}/settings/permissions`;

export const newRoleHref = (workspaceId: string) =>
  `${permissionsHref(workspaceId)}/roles/new`;

export const editRoleHref = (workspaceId: string, roleId: string) =>
  `${permissionsHref(workspaceId)}/roles/${roleId}`;
