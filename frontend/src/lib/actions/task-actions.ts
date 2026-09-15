"use server";

import { revalidateBacklog } from "@/lib/actions/revalidate-backlog";
import {
  addTaskComment,
  createTask,
  deleteTask,
  deleteTaskComment,
  getTaskComments,
  updateTask,
  type TaskInput,
  type TaskPatch,
} from "@/lib/tasks";
import type { Task, TaskComment } from "@/types/task";

/*
 * Every task and comment write. Thin by rule: validate what the API's `400`
 * would describe badly, call `lib/tasks.ts`, revalidate. The rules themselves
 * live on the server — `backend/docs/api/task.md`.
 *
 * Plain arguments, called from `useTransition` handlers, the same shape as
 * `project-actions.ts` — so a drawer branches on the result and closes itself
 * in the handler instead of watching for success in an effect.
 *
 * **Permissions are not checked here.** `lib/task-roles.ts` decides which
 * controls are drawn; the API's `requireProjectContribute` enforces them.
 */

export type TaskFormState = {
  code?: string;
  fieldErrors?: Record<string, string>;
  task?: Task;
};

const TITLE_MAX = 200;

function titleError(title: string): string | undefined {
  if (!title) return "Give the task a title.";
  return title.length > TITLE_MAX ? `Keep it under ${TITLE_MAX} characters.` : undefined;
}

export async function createTaskAction(
  workspaceId: string,
  projectId: string,
  input: TaskInput,
): Promise<TaskFormState> {
  const title = input.title.trim();
  const invalid = titleError(title);
  if (invalid) return { fieldErrors: { title: invalid } };

  const result = await createTask(projectId, { ...input, title });
  if (!result.ok) return { code: result.code, fieldErrors: result.fieldErrors };

  revalidateBacklog(workspaceId, projectId);
  return { task: result.data };
}

/** `null` is meaningful on every optional field — it is how the API clears one — so it survives the trip. */
export async function updateTaskAction(
  workspaceId: string,
  projectId: string,
  taskId: string,
  patch: TaskPatch,
): Promise<TaskFormState> {
  if (patch.title !== undefined) {
    const invalid = titleError(patch.title.trim());
    if (invalid) return { fieldErrors: { title: invalid } };
  }

  if (Object.keys(patch).length === 0) return {};

  const result = await updateTask(taskId, {
    ...patch,
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
  });
  if (!result.ok) return { code: result.code, fieldErrors: result.fieldErrors };

  revalidateBacklog(workspaceId, projectId);
  return { task: result.data };
}

export async function deleteTaskAction(
  workspaceId: string,
  projectId: string,
  taskId: string,
): Promise<TaskFormState> {
  const result = await deleteTask(taskId);
  if (!result.ok) return { code: result.code };

  revalidateBacklog(workspaceId, projectId);
  return {};
}

/*
 * Comments are READ through an action too, and that is deliberate: the drawer
 * opens on a click, a task's thread is only wanted once someone opens it, and
 * the page fetching every thread of a 200-task backlog up front would be 200
 * requests nobody asked for. The panel starts this call in the click handler
 * and the thread `use()`s the promise — no effect, no waterfall.
 */
export async function listTaskCommentsAction(
  taskId: string,
): Promise<{ code?: string; comments: TaskComment[] }> {
  const result = await getTaskComments(taskId);

  return result.ok ? { comments: result.data } : { code: result.code, comments: [] };
}

export async function addTaskCommentAction(
  workspaceId: string,
  projectId: string,
  taskId: string,
  body: string,
): Promise<{ code?: string; comment?: TaskComment }> {
  const text = body.trim();
  if (!text) return { code: "VALIDATION_ERROR" };

  const result = await addTaskComment(taskId, text);
  if (!result.ok) return { code: result.code };

  /* The row's comment count is on the backlog. */
  revalidateBacklog(workspaceId, projectId);
  return { comment: result.data };
}

export async function deleteTaskCommentAction(
  workspaceId: string,
  projectId: string,
  taskId: string,
  commentId: string,
): Promise<{ code?: string }> {
  const result = await deleteTaskComment(taskId, commentId);
  if (!result.ok) return { code: result.code };

  revalidateBacklog(workspaceId, projectId);
  return {};
}
