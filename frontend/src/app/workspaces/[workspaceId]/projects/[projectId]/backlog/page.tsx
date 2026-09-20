import { PageTop } from "@/components/layout/page-top";
import { notFound, redirect } from "next/navigation";
import { BacklogPageHeader } from "@/components/backlog/backlog-page-header";
import { ProjectBacklog } from "@/components/tasks/project-backlog";
import { getSession } from "@/lib/auth";
import { getProject } from "@/lib/projects";
import { getWorkspace } from "@/lib/workspaces";

export async function generateMetadata({
  params,
}: PageProps<"/workspaces/[workspaceId]/projects/[projectId]/backlog">) {
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
    title: `Backlog · ${project.name}`,
    description: `Every task in ${project.name} that is not yet committed to a sprint.`,
  };
}

/**
 * One project's backlog, addressed by workspace and project in the path. The
 * same list and drawer `/board/backlog` shows — both render `ProjectBacklog`.
 *
 * One `404` covers a missing workspace, a missing project and a project that
 * belongs to a different workspace than the URL claims.
 */
export default async function ProjectBacklogPage({
  params,
}: PageProps<"/workspaces/[workspaceId]/projects/[projectId]/backlog">) {
  const { workspaceId, projectId } = await params;

  const user = await getSession();
  if (!user) {
    redirect(`/sign-in?next=/workspaces/${workspaceId}/projects/${projectId}/backlog`);
  }

  const [workspace, project] = await Promise.all([
    getWorkspace(workspaceId),
    getProject(projectId),
  ]);

  if (!workspace || !project || project.workspaceId !== workspace.id) notFound();

  return (
    <main className="w-full px-4 pb-8 sm:px-6">
      <PageTop>
        <BacklogPageHeader workspaceId={workspace.id} project={project} />
      </PageTop>
      <ProjectBacklog workspace={workspace} project={project} userId={user.id} />
    </main>
  );
}
