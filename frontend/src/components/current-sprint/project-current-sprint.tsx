import { CurrentSprintBoard } from "@/components/current-sprint/current-sprint-board";
import { loadTaskScope } from "@/components/tasks/load-task-scope";
import type { ProjectRecord } from "@/types/project";
import type { Workspace } from "@/types/workspace";

/**
 * One project's current sprint board — tasks, statuses, sprints and the
 * `TaskScope`, read on the server by the same loader the backlog and sprint
 * planning use, so the three screens agree on who may edit what.
 *
 * `key` on the board resets its filters and open dialogs when the project changes.
 */
export async function ProjectCurrentSprint({
  workspace,
  project,
  userId,
  actions,
}: {
  workspace: Workspace;
  project: ProjectRecord;
  userId: string;
  actions?: React.ReactNode;
}) {
  const { tasks, scope } = await loadTaskScope({ workspace, project, userId });

  return (
    <CurrentSprintBoard
      key={project.id}
      tasks={tasks}
      scope={scope}
      actions={actions}
      planningHref={`/board/sprint-planning?project=${project.id}`}
    />
  );
}
