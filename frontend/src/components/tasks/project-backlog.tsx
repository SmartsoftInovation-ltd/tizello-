import type { ReactNode } from "react";
import { loadTaskScope } from "@/components/tasks/load-task-scope";
import { TaskBacklogPanel } from "@/components/tasks/task-backlog-panel";
import type { ProjectRecord } from "@/types/project";
import type { Workspace } from "@/types/workspace";

/**
 * One project's real backlog — the tasks and the `TaskScope` read on the server
 * (`load-task-scope.ts`) and handed to the client panel.
 *
 * A Server Component shared by BOTH routes that show a backlog: `/board/backlog`
 * (what the sidebar opens, with a project picker above it) and
 * `/workspaces/[id]/projects/[id]/backlog`.
 *
 * `key={project.id}` on the panel is load-bearing: switching project in the
 * picker keeps this component in the same tree position, and without the key
 * the panel would carry the previous project's open drawer and collapsed
 * groups across the switch.
 */
export async function ProjectBacklog({
  workspace,
  project,
  userId,
  leading,
  actions,
}: {
  workspace: Workspace;
  project: ProjectRecord;
  userId: string;
  /** Toolbar slots, passed straight through — see `TaskBacklogToolbar`. */
  leading?: ReactNode;
  actions?: ReactNode;
}) {
  const { tasks, scope } = await loadTaskScope({ workspace, project, userId });

  return (
    <TaskBacklogPanel key={project.id} tasks={tasks} scope={scope} leading={leading} actions={actions} />
  );
}
