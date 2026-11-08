import { notFound, redirect } from "next/navigation";
import { PageTop } from "@/components/layout/page-top";
import { RoleEditorHeader } from "@/components/permissions/role-editor-header";
import { RoleForm } from "@/components/permissions/role-form";
import { canManageRoles } from "@/lib/roles";
import { permissionsHref } from "@/lib/role-paths";
import { getPermissionCatalog, getRoles } from "@/lib/workspace-roles";
import { getWorkspace } from "@/lib/workspaces";

export async function generateMetadata({
  params,
}: PageProps<"/workspaces/[workspaceId]/settings/permissions/roles/[roleId]">) {
  const { workspaceId } = await params;
  const workspace = await getWorkspace(workspaceId);

  return {
    title: workspace ? `Edit role · ${workspace.name}` : "Workspace not found",
    description: "Change a role's name, access level and permissions.",
  };
}

export default async function EditRolePage({
  params,
}: PageProps<"/workspaces/[workspaceId]/settings/permissions/roles/[roleId]">) {
  const { workspaceId, roleId } = await params;
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) notFound();
  if (!canManageRoles(workspace.role)) redirect(permissionsHref(workspaceId));

  const [groups, roles] = await Promise.all([
    getPermissionCatalog(workspaceId),
    getRoles(workspaceId),
  ]);

  /* Built-ins are locked — the app is written against what OWNER means — so
     an edit URL for one is as missing as an id that never existed. */
  const role = roles.find((candidate) => candidate.id === roleId);
  if (!role || role.builtIn) notFound();

  return (
    <main className="w-full px-4 sm:px-6">
      <PageTop>
        <RoleEditorHeader title={`Edit ${role.name}`} />
      </PageTop>
      <RoleForm workspaceId={workspaceId} role={role} groups={groups} />
    </main>
  );
}
