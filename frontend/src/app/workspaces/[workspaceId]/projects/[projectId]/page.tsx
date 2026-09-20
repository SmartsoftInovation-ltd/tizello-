import { PageTop } from "@/components/layout/page-top";
import { notFound, redirect } from "next/navigation";
import { ProjectArchivedBanner } from "@/components/projects/project-archived-banner";
import { ProjectDetailFacts } from "@/components/projects/project-detail-facts";
import { ProjectDetailHeader } from "@/components/projects/project-detail-header";
import { ProjectMembersPanel } from "@/components/projects/project-members-panel";
import { ProjectPropertiesPanel } from "@/components/projects/project-properties-panel";
import { getSession } from "@/lib/auth";
import { getProject } from "@/lib/projects";
import { getProjectMembers } from "@/lib/project-members";
import { getProjectPropertyDefs } from "@/lib/project-property-defs";
import { canManageProperties } from "@/lib/project-roles";
import { todayIso } from "@/lib/today";
import { getWorkspace, getWorkspaceMembers } from "@/lib/workspaces";

export async function generateMetadata({
  params,
}: PageProps<"/workspaces/[workspaceId]/projects/[projectId]">) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (!project) {
    return {
      title: "Project not found",
      description:
        "This project does not exist, or it is no longer shared with you.",
    };
  }

  return {
    title: project.name,
    description:
      project.description ?? `The record, dates and members of ${project.name}.`,
  };
}

/**
 * One project — `GET /projects/:id`, plus its roster.
 *
 * A single `404` covers a nonexistent id, a soft-deleted project and a project
 * in a workspace the caller does not belong to: the API answers all three
 * identically (project.md §*Guards* step 1), so `notFound()` is the only
 * honest branch. The workspace is fetched alongside it for the header's back
 * link and for the caller's WORKSPACE role, which the actions menu needs — the
 * project's own `viewerRole` is only half the ladder.
 */
export default async function ProjectPage({
  params,
}: PageProps<"/workspaces/[workspaceId]/projects/[projectId]">) {
  const { workspaceId, projectId } = await params;

  const user = await getSession();
  if (!user) {
    redirect(`/sign-in?next=/workspaces/${workspaceId}/projects/${projectId}`);
  }

  const [project, workspace, members, definitions, workspaceMembers] = await Promise.all([
    getProject(projectId),
    getWorkspace(workspaceId),
    getProjectMembers(projectId),
    getProjectPropertyDefs(workspaceId),
    /* The roster: what resolves the owner's id to a name and what the
       collaborator picker offers. */
    getWorkspaceMembers(workspaceId),
  ]);

  if (!project || !workspace) notFound();

  /* A project id is globally unique, so `/workspaces/<other>/projects/<id>`
     would otherwise render this project under a workspace it does not belong
     to — a URL somebody can hand-edit into a header that lies about where the
     project lives. */
  if (project.workspaceId !== workspace.id) notFound();

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
        <ProjectDetailHeader
          project={project}
          workspaceName={workspace.name}
          workspaceRole={workspace.role}
          scope={scope}
          members={members}
          workspaceMembers={workspaceMembers}
        />
      </PageTop>

      {project.isArchived && (
        <ProjectArchivedBanner
          workspaceRole={workspace.role}
          viewerRole={project.viewerRole}
        />
      )}

      <ProjectDetailFacts project={project} />

      {/* The workspace's custom columns, with this project's values — the half
          of the create drawer the page used to collect and never show. */}
      <ProjectPropertiesPanel project={project} definitions={definitions} />

      <ProjectMembersPanel members={members} currentUserId={user.id} />
    </main>
  );
}
