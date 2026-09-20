import { PageTop } from "@/components/layout/page-top";
import { notFound } from "next/navigation";
import { PermissionsBoard } from "@/components/permissions/permissions-board";
import { PermissionsPageHeader } from "@/components/permissions/permissions-page-header";
import { getSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspaces";
import { getMembers } from "@/lib/members";
import {
  getPermissionMatrix,
  getWorkspaceRoles,
} from "@/lib/demo-permissions";

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

     The ROSTER is real (`GET /workspaces/:id/members`); the matrix and the role
     list are still fixtures, because the API has three roles and no endpoint
     for defining a fourth. See `use-roles.ts` for which half of this screen
     persists. */
  const [groups, roles, members, user] = await Promise.all([
    getPermissionMatrix(workspaceId),
    getWorkspaceRoles(workspaceId),
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
        workspaceId={workspaceId}
      />
    </main>
  );
}
