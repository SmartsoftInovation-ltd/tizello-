import { notFound, redirect } from "next/navigation";
import { SprintWorkflowNav } from "@/components/sprint-board/sprint-workflow-nav";
import { PlanningPageHeader } from "@/components/sprint-planning/planning-page-header";
import { ProjectSprintPlanning } from "@/components/sprint-planning/project-sprint-planning";
import { getSession } from "@/lib/auth";
import { getProject } from "@/lib/projects";
import { getWorkspace } from "@/lib/workspaces";

export async function generateMetadata({
  params,
}: PageProps<"/workspaces/[workspaceId]/projects/[projectId]/sprint-planning">) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (!project) {
    return {
      title: "Project not found",
      description: "This project does not exist, or it is no longer shared with you.",
    };
  }

  return {
    title: `Sprint planning · ${project.name}`,
    description: `Drag ${project.name}'s work from the backlog into sprints, estimate it, and start and complete sprints.`,
  };
}

/**
 * One project's sprint planning, addressed by the project — the same real
 * screen `/board/sprint-planning` renders (`project-sprint-planning.tsx`), with
 * the project's own header instead of a picker.
 */
export default async function SprintPlanningPage({
  params,
}: PageProps<"/workspaces/[workspaceId]/projects/[projectId]/sprint-planning">) {
  const { workspaceId, projectId } = await params;

  const user = await getSession();
  if (!user) redirect(`/sign-in?next=/workspaces/${workspaceId}/projects/${projectId}/sprint-planning`);

  const [workspace, project] = await Promise.all([getWorkspace(workspaceId), getProject(projectId)]);

  /* A project id under someone else's workspace id is a 404, not this
     project under the wrong breadcrumb. */
  if (!workspace || !project || project.workspaceId !== workspace.id) notFound();

  return (
    <main className="w-full px-4 py-8 sm:px-6">
      <div className="mb-6">
        <SprintWorkflowNav current="sprint-planning" />
      </div>
      <PlanningPageHeader workspaceId={workspace.id} project={project} />
      <ProjectSprintPlanning workspace={workspace} project={project} userId={user.id} />
    </main>
  );
}
