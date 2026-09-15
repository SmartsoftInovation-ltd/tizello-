import type { TaskScope } from "@/components/tasks/task-draft";
import { canWriteProject } from "@/lib/project-roles";
import { getSprints } from "@/lib/sprints";
import { getTaskPropertyDefs } from "@/lib/task-property-defs";
import { getTaskStatuses } from "@/lib/task-statuses";
import { canContributeToProject } from "@/lib/task-roles";
import { getProjectTasks } from "@/lib/tasks";
import { todayIso } from "@/lib/today";
import { getWorkspaceMembers } from "@/lib/workspaces";
import type { ProjectRecord } from "@/types/project";
import type { Task } from "@/types/task";
import type { Workspace } from "@/types/workspace";

/**
 * Reads everything a task screen needs for one project — its tasks, columns,
 * statuses, sprints and the workspace roster — in parallel, on the server, and
 * builds the one `TaskScope` every drawer and row below reads.
 *
 * Shared by the BACKLOG (`project-backlog.tsx`) and SPRINT PLANNING
 * (`project-sprint-planning.tsx`), so the two screens cannot disagree about who
 * may edit what — they show the same tasks in different containers, and a
 * permission that differed between them would be a bug nobody could explain.
 *
 * Server-only: it calls the API through `lib/api-client.ts`.
 */
export async function loadTaskScope({
  workspace,
  project,
  userId,
}: {
  workspace: Workspace;
  project: ProjectRecord;
  userId: string;
}): Promise<{ tasks: Task[]; scope: TaskScope }> {
  const [tasks, definitions, statuses, members, sprints] = await Promise.all([
    getProjectTasks(project.id),
    getTaskPropertyDefs(project.id),
    getTaskStatuses(project.id),
    getWorkspaceMembers(workspace.id),
    getSprints(project.id),
  ]);

  return {
    tasks,
    scope: {
      workspaceId: workspace.id,
      projectId: project.id,
      projectName: project.name,
      today: todayIso(),
      currentUserId: userId,
      members,
      definitions,
      statuses,
      sprints,
      canManageProperties: canWriteProject(workspace.role, project.viewerRole),
      canContribute: canContributeToProject(workspace.role, project.viewerRole),
    },
  };
}
