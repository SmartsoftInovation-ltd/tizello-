import { apiCallWithRefresh } from "@/lib/api-client";
import type { ActionResult } from "@/lib/workspaces";
import type { ProjectPriority } from "@/types/project";
import type { Task, TaskType } from "@/types/task";

/*
 * The task writes that touch RANK or MANY ROWS — `backend/docs/api/task.md`
 * §8b–§8d. Beside `lib/tasks.ts` rather than in it, which is at the line cap.
 *
 * A move names NEIGHBOURS, never a number: the server takes the midpoint and
 * respaces the project when a gap runs out (§Ordering), so two people ranking
 * the same backlog from stale copies cannot write colliding positions.
 */

export type TaskMove = {
  statusId?: string;
  /** The container: a sprint id, or `null` for the backlog. */
  sprintId?: string | null;
  /** The task directly above the new spot, or `null` for the top. */
  afterId?: string | null;
  /** The task directly below the new spot, or `null` for the bottom. */
  beforeId?: string | null;
};

/** What a selection can share. Per-task fields (title, description) are deliberately absent. */
export type TaskBulkPatch = {
  statusId?: string;
  type?: TaskType;
  priority?: ProjectPriority | null;
  assigneeId?: string | null;
  storyPoints?: number | null;
  dueDate?: string | null;
  sprintId?: string | null;
};

/** The API's ceiling per bulk request. */
export const BULK_MAX = 100;

/** `PATCH /tasks/:taskId/move`. */
export async function moveTask(taskId: string, move: TaskMove): Promise<ActionResult<Task>> {
  const result = await apiCallWithRefresh<{ task: Task }>(
    `/tasks/${encodeURIComponent(taskId)}/move`,
    { method: "PATCH", body: move },
  );

  return result.ok ? { ok: true, data: result.data.task } : { ok: false, code: result.code };
}

/** `PATCH /projects/:projectId/tasks/bulk`. All or nothing on the server. */
export async function bulkUpdateTasks(
  projectId: string,
  taskIds: string[],
  patch: TaskBulkPatch,
): Promise<ActionResult<Task[]>> {
  const result = await apiCallWithRefresh<{ tasks: Task[] }>(
    `/projects/${encodeURIComponent(projectId)}/tasks/bulk`,
    { method: "PATCH", body: { taskIds, patch } },
  );

  return result.ok ? { ok: true, data: result.data.tasks } : { ok: false, code: result.code };
}

/** `POST /projects/:projectId/tasks/bulk-delete`. Sub-tasks of deleted tasks move to the top level. */
export async function bulkDeleteTasks(
  projectId: string,
  taskIds: string[],
): Promise<ActionResult<{ deleted: number }>> {
  const result = await apiCallWithRefresh<{ deleted: number }>(
    `/projects/${encodeURIComponent(projectId)}/tasks/bulk-delete`,
    { method: "POST", body: { taskIds } },
  );

  return result.ok ? { ok: true, data: result.data } : { ok: false, code: result.code };
}
