import { notFound, redirect } from "next/navigation";
import { PageTop } from "@/components/layout/page-top";
import { RoleEditorHeader } from "@/components/permissions/role-editor-header";
import { RoleForm } from "@/components/permissions/role-form";
import { canManageRoles } from "@/lib/roles";
import { permissionsHref } from "@/lib/role-paths";
import { getPermissionCatalog } from "@/lib/workspace-roles";
import { getWorkspace } from "@/lib/workspaces";

export async function generateMetadata({
  params,
}: PageProps<"/workspaces/[workspaceId]/settings/permissions/roles/new">) {
  const { workspaceId } = await params;
  const workspace = await getWorkspace(workspaceId);

  return {
    title: workspace ? `New role · ${workspace.name}` : "Workspace not found",
    description: "Define a role: its name, access level and permissions.",
  };
}

export default async function NewRolePage({
  params,
}: PageProps<"/workspaces/[workspaceId]/settings/permissions/roles/new">) {
  const { workspaceId } = await params;
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) notFound();

  /* Drawn from, never enforced with — the API's `roles.manage` is the control.
     Someone without it is sent back rather than shown a form that 403s. */
  if (!canManageRoles(workspace.role)) redirect(permissionsHref(workspaceId));

  const groups = await getPermissionCatalog(workspaceId);

  return (
    <main className="w-full px-4 sm:px-6">
      <PageTop>
        <RoleEditorHeader title="Create a role" />
      </PageTop>
      <RoleForm workspaceId={workspaceId} role={null} groups={groups} />
    </main>
  );
}
