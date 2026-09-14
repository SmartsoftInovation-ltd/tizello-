import { notFound } from "next/navigation";
import { SprintWorkflowNav } from "@/components/sprint-board/sprint-workflow-nav";
import { PlanningPageHeader } from "@/components/sprint-planning/planning-page-header";
import { SprintPlanningPanel } from "@/components/sprint-planning/sprint-planning-panel";
import { getProjectTasks } from "@/lib/demo-backlog";
import { getWorkspace } from "@/lib/workspaces";
import { DEMO_TODAY, getProject } from "@/lib/demo-projects";
import { getProjectSprints } from "@/lib/demo-sprints";

export async function generateMetadata({
  params,
}: PageProps<"/workspaces/[workspaceId]/projects/[projectId]/sprint-planning">) {
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
    title: `Sprint planning · ${project.name}`,
    description: `Pull work out of ${project.name}'s backlog into the sprint being planned, and watch the story points against capacity.`,
  };
}

export default async function SprintPlanningPage({
  params,
}: PageProps<"/workspaces/[workspaceId]/projects/[projectId]/sprint-planning">) {
  /* `params` is a Promise in Next 16, and it is awaited. */
  const { workspaceId, projectId } = await params;

  /* Both reads happen on the server. A missing workspace or a missing project
     is `notFound()`, not an empty shell — planning belongs to a project, and a
     page that renders the chrome around nothing is a worse answer than 404. */
  const [workspace, project] = await Promise.all([
    getWorkspace(workspaceId),
    getProject(projectId),
  ]);
  if (!workspace || !project) notFound();

  /* Every task, not just the backlog: this screen renders both containers side
     by side, and the panel decides which side a row is on from its `sprintId`. */
  const [tasks, sprints] = await Promise.all([
    getProjectTasks(projectId),
    getProjectSprints(projectId),
  ]);

  return (
    <main className="w-full px-4 py-8 sm:px-6">
      <div className="mb-6">
        <SprintWorkflowNav current="sprint-planning" />
      </div>
      <PlanningPageHeader workspaceId={workspace.id} project={project} />

      {/* Everything below the header is interactive, so `SprintPlanningPanel`
          is the client leaf — the header itself ships no JavaScript.

          `today` is the app's pinned date rather than a live clock: a value
          read from `new Date()` during render differs between the server pass
          and hydration, and React throws the node away. See `demo-projects.ts`. */}
      <SprintPlanningPanel tasks={tasks} sprints={sprints} today={DEMO_TODAY} />
    </main>
  );
}
