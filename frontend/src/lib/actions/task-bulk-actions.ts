"use server";

import { revalidateBacklog } from "@/lib/actions/revalidate-backlog";
import {
  BULK_MAX,
  bulkDeleteTasks,
  bulkUpdateTasks,
  moveTask,
  type TaskBulkPatch,
  type TaskMove,
} from "@/lib/task-bulk";
import { getTaskActivity, updateTaskComment } from "@/lib/task-history";
import type { TaskActivity } from "@/types/task-activity";
import type { TaskComment } from "@/types/task";

/*
 * Rank, bulk and history writes — the same thin shape as `task-actions.ts`:
 * refuse what the API would describe badly, call `lib/`, revalidate. Split
 * from that file for the line cap, along the seam these share: none of them
 * is "edit one task's fields".
 *
 * **Permissions are not checked here.** The API's guards enforce them.
 */

type Result = { code?: string };

/** Drag a task to a new spot, and optionally a new status. */
export async function moveTaskAction(
  workspaceId: string,
  projectId: string,
  taskId: string,
  move: TaskMove,
): Promise<Result> {
  const result = await moveTask(taskId, move);
  if (!result.ok) return { code: result.code };

  revalidateBacklog(workspaceId, projectId);
  return {};
}

export async function bulkUpdateTasksAction(
  workspaceId: string,
  projectId: string,
  taskIds: string[],
  patch: TaskBulkPatch,
): Promise<Result> {
  if (taskIds.length === 0 || taskIds.length > BULK_MAX) return { code: "VALIDATION_ERROR" };

  const result = await bulkUpdateTasks(projectId, taskIds, patch);
  if (!result.ok) return { code: result.code };

  revalidateBacklog(workspaceId, projectId);
  return {};
}

export async function bulkDeleteTasksAction(
  workspaceId: string,
  projectId: string,
  taskIds: string[],
): Promise<Result> {
  if (taskIds.length === 0 || taskIds.length > BULK_MAX) return { code: "VALIDATION_ERROR" };

  const result = await bulkDeleteTasks(projectId, taskIds);
  if (!result.ok) return { code: result.code };

  revalidateBacklog(workspaceId, projectId);
  return {};
}

/**
 * Read through an action for the reason comments are
 * (`listTaskCommentsAction`): history is only wanted once someone asks for it,
 * so the drawer starts this call in the click and the list `use()`s it.
 */
export async function listTaskActivityAction(
  taskId: string,
): Promise<{ code?: string; activity: TaskActivity[] }> {
  const result = await getTaskActivity(taskId);

  return result.ok ? { activity: result.data } : { code: result.code, activity: [] };
}

/** No revalidate: an edit changes no count or field the backlog draws. */
export async function updateTaskCommentAction(
  taskId: string,
  commentId: string,
  body: string,
): Promise<{ code?: string; comment?: TaskComment }> {
  const text = body.trim();
  if (!text) return { code: "VALIDATION_ERROR" };

  const result = await updateTaskComment(taskId, commentId, text);
  return result.ok ? { comment: result.data } : { code: result.code };
}
