import { PageTop } from "@/components/layout/page-top";
import { notFound } from "next/navigation";
import { PermissionsBoard } from "@/components/permissions/permissions-board";
import { PermissionsPageHeader } from "@/components/permissions/permissions-page-header";
import { getSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspaces";
import { getMembers } from "@/lib/members";
import { canManageRoles } from "@/lib/roles";
import { getPermissionCatalog, getRoles } from "@/lib/workspace-roles";

export async function generateMetadata({
  params,
}: PageProps<"/workspaces/[workspaceId]/settings/permissions">) {
  const { workspaceId } = await params;
  const workspace = await getWorkspace(workspaceId);

  if (!workspace) {
    return {
      title: "Workspace not found",
      description:
        "This workspace does not exist, or it is no longer shared with you.",
    };
  }

  return {
    title: `Roles & permissions · ${workspace.name}`,
    description: `What each role can do in ${workspace.name}, and who holds which one.`,
  };
}

export default async function PermissionsPage({
  params,
}: PageProps<"/workspaces/[workspaceId]/settings/permissions">) {
  const { workspaceId } = await params;
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) notFound();

  /* All four reads happen on the server and travel down as plain props. The
     header ships no JavaScript; everything below it shares one state.

     ALL FOUR ARE REAL NOW. The matrix rows are the permission catalog the
     server gates on (`GET .../roles/permissions`), and the roles are rows in
     `workspace_roles` — built-ins seeded on first read, custom ones defined
     here. Nothing on this screen is a fixture any more, which is what makes
     the grid a description of enforcement rather than a drawing of one. */
  const [groups, roles, members, user] = await Promise.all([
    getPermissionCatalog(workspaceId),
    getRoles(workspaceId),
    getMembers(workspaceId),
    getSession(),
  ]);

  return (
    <main className="w-full px-4 pb-8 sm:px-6">
      <PageTop>
        <PermissionsPageHeader workspace={workspace} />
      </PageTop>
      <PermissionsBoard
        groups={groups}
        roles={roles}
        members={members}
        currentUserId={user?.id ?? ""}
        viewerRole={workspace.role}
        /* Drawn from, never enforced with — `requirePermission(ROLE_MANAGE)`
           is the control. See the mirror note in `lib/roles.ts`. */
        canManageRoles={canManageRoles(workspace.role)}
        workspaceId={workspaceId}
      />
    </main>
  );
}
