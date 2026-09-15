import { apiCallWithRefresh } from "@/lib/api-client";
import type { ActionResult } from "@/lib/workspaces";
import type { TaskActivity, TaskComment } from "@/types/task";

/*
 * What a task's history is made of: its activity log and comment edits —
 * `backend/docs/api/task.md` §7a and §8a. Beside `lib/tasks.ts`, which is at
 * the line cap.
 */

/** `GET /tasks/:taskId/activity`, newest first. */
export async function getTaskActivity(taskId: string): Promise<ActionResult<TaskActivity[]>> {
  const result = await apiCallWithRefresh<{ activity: TaskActivity[] }>(
    `/tasks/${encodeURIComponent(taskId)}/activity`,
  );

  return result.ok ? { ok: true, data: result.data.activity } : { ok: false, code: result.code };
}

/** `PATCH /tasks/:taskId/comments/:commentId` — the author only; stamps `editedAt`. */
export async function updateTaskComment(
  taskId: string,
  commentId: string,
  body: string,
): Promise<ActionResult<TaskComment>> {
  const result = await apiCallWithRefresh<{ comment: TaskComment }>(
    `/tasks/${encodeURIComponent(taskId)}/comments/${encodeURIComponent(commentId)}`,
    { method: "PATCH", body: { body } },
  );

  return result.ok ? { ok: true, data: result.data.comment } : { ok: false, code: result.code };
}
