import type { ReactNode } from "react";
import { TaskBacklogPanel } from "@/components/tasks/task-backlog-panel";
import type { TaskScope } from "@/components/tasks/task-draft";
import { canWriteProject } from "@/lib/project-roles";
import { getTaskPropertyDefs } from "@/lib/task-property-defs";
import { getTaskStatuses } from "@/lib/task-statuses";
import { canContributeToProject } from "@/lib/task-roles";
import { getProjectTasks } from "@/lib/tasks";
import { todayIso } from "@/lib/today";
import { getWorkspaceMembers } from "@/lib/workspaces";
import type { ProjectRecord } from "@/types/project";
import type { Workspace } from "@/types/workspace";

/**
 * One project's real backlog — the tasks, this project's task columns and the
 * roster the assignee picker offers, read in parallel on the server and handed
 * to the client panel as one `TaskScope`.
 *
 * A Server Component shared by BOTH routes that show a backlog: `/board/backlog`
 * (what the sidebar opens, with a project picker above it) and
 * `/workspaces/[id]/projects/[id]/backlog`. One place builds the scope, so the
 * two cannot disagree about who may edit what.
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
  const [tasks, definitions, statuses, members] = await Promise.all([
    getProjectTasks(project.id),
    getTaskPropertyDefs(project.id),
    getTaskStatuses(project.id),
    getWorkspaceMembers(workspace.id),
  ]);

  const scope: TaskScope = {
    workspaceId: workspace.id,
    projectId: project.id,
    projectName: project.name,
    today: todayIso(),
    currentUserId: userId,
    members,
    definitions,
    statuses,
    canManageProperties: canWriteProject(workspace.role, project.viewerRole),
    canContribute: canContributeToProject(workspace.role, project.viewerRole),
  };

  return (
    <TaskBacklogPanel
      key={project.id}
      tasks={tasks}
      scope={scope}
      leading={leading}
      actions={actions}
    />
  );
}
