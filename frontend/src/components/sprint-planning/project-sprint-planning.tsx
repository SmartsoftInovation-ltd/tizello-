import { SprintPlanningBoard } from "@/components/sprint-planning/sprint-planning-board";
import { loadTaskScope } from "@/components/tasks/load-task-scope";
import type { ProjectRecord } from "@/types/project";
import type { Workspace } from "@/types/workspace";

/**
 * One project's sprint planning — tasks, sprints and the `TaskScope` read on
 * the server by the same loader the backlog uses, handed to the client board.
 *
 * Shared by `/board/sprint-planning` (the sidebar's link, with a project
 * picker) and `/workspaces/[id]/projects/[id]/sprint-planning`. `key` on the
 * board resets its filters, selection and open dialogs when the project changes.
 */
export async function ProjectSprintPlanning({
  workspace,
  project,
  userId,
}: {
  workspace: Workspace;
  project: ProjectRecord;
  userId: string;
}) {
  const { tasks, scope } = await loadTaskScope({ workspace, project, userId });

  return <SprintPlanningBoard key={project.id} tasks={tasks} scope={scope} />;
}
