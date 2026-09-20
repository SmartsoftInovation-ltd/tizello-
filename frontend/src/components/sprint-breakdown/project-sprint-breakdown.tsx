import { SprintBreakdownPanel } from "@/components/sprint-breakdown/sprint-breakdown-panel";
import { loadTaskScope } from "@/components/tasks/load-task-scope";
import type { BreakdownChart } from "@/lib/sprint-breakdown-view";
import type { ProjectRecord } from "@/types/project";
import type { Workspace } from "@/types/workspace";

/**
 * One project's sprint breakdown — the same `loadTaskScope` the board, the
 * backlog and sprint planning use, so this screen can never be measuring a
 * different set of tasks than the board it sits beside.
 *
 * Deliberately the twin of `project-current-sprint.tsx`: same loader, same
 * props, a different panel. If the board's data ever needs more, both get it
 * from one change.
 */
export async function ProjectSprintBreakdown({
  workspace,
  project,
  userId,
  chart,
}: {
  workspace: Workspace;
  project: ProjectRecord;
  userId: string;
  chart: BreakdownChart;
}) {
  const { tasks, scope } = await loadTaskScope({ workspace, project, userId });

  return <SprintBreakdownPanel tasks={tasks} scope={scope} chart={chart} projectId={project.id} />;
}
