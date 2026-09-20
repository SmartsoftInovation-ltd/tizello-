import { PageTop } from "@/components/layout/page-top";
import { notFound } from "next/navigation";
import { ProjectGrid } from "@/components/workspace/project-grid";
import { WorkspaceArchivedBanner } from "@/components/workspace/workspace-archived-banner";
import { WorkspaceDetailFacts } from "@/components/workspace/workspace-detail-facts";
import { WorkspaceDetailHeader } from "@/components/workspace/workspace-detail-header";
import { getSession } from "@/lib/auth";
import { getWorkspaceProjects } from "@/lib/projects";
import { getProjectPropertyDefs } from "@/lib/project-property-defs";
import { canManageProperties } from "@/lib/project-roles";
import { todayIso } from "@/lib/today";
import { getWorkspace, getWorkspaceMembers, getWorkspaces } from "@/lib/workspaces";

export async function generateMetadata({
  params,
}: PageProps<"/workspaces/[workspaceId]">) {
  const { workspaceId } = await params;
  const workspace = await getWorkspace(workspaceId);

  if (!workspace) {
    return {
      title: "Workspace not found",
      description: "This workspace does not exist, or it is no longer shared with you.",
    };
  }

  return {
    title: workspace.name,
    description:
      workspace.description ?? `The projects, members and settings of ${workspace.name}.`,
  };
}

/**
 * Feature 1 — one workspace, read from `GET /workspaces/:id` rather than from
 * `demo-data.ts`.
 *
 * `getWorkspace` answers `null` for a workspace that does not exist, one that
 * has been soft-deleted, and one the caller is not a member of — the API
 * collapses all three into the same `404` deliberately, so that nobody can
 * probe for the existence of a workspace they cannot see. `notFound()` renders
 * this segment's `not-found.tsx` for all three.
 *
 * The workspace list alongside it is what the header's Switch menu needs
 * (feature 5), and it is fetched here rather than inside that menu so the whole
 * header stays a Server Component. `includeArchived` is on: an archived
 * workspace you are currently looking at has to appear in its own switcher.
 */
export default async function WorkspacePage({
  params,
}: PageProps<"/workspaces/[workspaceId]">) {
  const { workspaceId } = await params;

  const [user, workspace, workspaces, projects, definitions, workspaceMembers] =
    await Promise.all([
    /* For the Owner row in the edit drawer — "You" needs no name lookup. */
    getSession(),
    getWorkspace(workspaceId),
    getWorkspaces({ includeArchived: true }),
    /* Fetched in parallel with the workspace rather than after it: a 404 here
       is the same 404 the workspace lookup returns, so there is nothing the
       later call would learn by waiting. */
    getWorkspaceProjects(workspaceId),
    getProjectPropertyDefs(workspaceId),
    /* The pool the create drawer's Collaborators row picks from. */
    getWorkspaceMembers(workspaceId),
  ]);
  if (!workspace) notFound();

  /* One object rather than five props: `workspaceId`, `workspaceName`,
     `today`, the workspace's property schema and the admin flag all travel
     together to every project control several levels down. See
     `project-properties.ts`. */
  const scope = {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    today: todayIso(),
    definitions,
    canManageProperties: canManageProperties(workspace.role),
    currentUserId: user?.id,
    workspaceMembers,
  };

  return (
    <main className="w-full px-4 pb-8 sm:px-6">
      <PageTop>
        <WorkspaceDetailHeader workspace={workspace} workspaces={workspaces} />
      </PageTop>

      {workspace.isArchived && <WorkspaceArchivedBanner role={workspace.role} />}

      <WorkspaceDetailFacts workspace={workspace} />

      <ProjectGrid
        projects={projects}
        workspaceId={workspace.id}
        workspaceRole={workspace.role}
        scope={scope}
      />
    </main>
  );
}
