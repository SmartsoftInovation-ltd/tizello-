import { apiCallWithRefresh } from "@/lib/api-client";
import { fieldErrorsFrom } from "@/lib/field-errors";
import type { ActionResult } from "@/lib/workspaces";
import type { ProjectPriority } from "@/types/project";
import type { ProjectPropertyPatch, UploadedFile } from "@/types/project-property";
import type { Task, TaskComment, TaskType } from "@/types/task";

/*
 * The task API — `backend/docs/api/task.md`.
 *
 * TWO PREFIXES, like `lib/projects.ts` and for the same reason: create and list
 * carry the PROJECT in the path, because there is no task yet to address;
 * everything else is addressed by the task's own globally unique id.
 *
 * Every call goes through `apiCallWithRefresh` — all of these are
 * authenticated, and a lapsed access token should renew rather than bounce.
 */

/** The API's page ceiling for tasks. One request draws a whole backlog. */
const MAX_PAGE_SIZE = 500;

export type TaskInput = {
  title: string;
  description?: string | null;
  type?: TaskType;
  storyPoints?: number | null;
  icon?: string | null;
  color?: string | null;
  /** One of the project's status options. Omitted on create → the project's default. */
  statusId?: string;
  priority?: ProjectPriority | null;
  /** The WHOLE set of assignees — it replaces what is stored; `[]` unassigns everyone. */
  assigneeIds?: string[];
  dueDate?: string | null;
  completedAt?: string | null;
  tags?: string[];
  attachments?: UploadedFile[];
  parentId?: string | null;
  /** A sprint of this project, or `null` for the backlog. */
  sprintId?: string | null;
  /** Partial and keyed by definition id; `null` on a key DELETES that value. */
  properties?: ProjectPropertyPatch;
};

export type TaskPatch = Partial<TaskInput>;

/** `GET /projects/:projectId/tasks` — every live task, sub-tasks included, oldest first. */
export async function getProjectTasks(projectId: string): Promise<Task[]> {
  const result = await apiCallWithRefresh<Task[]>(
    `/projects/${encodeURIComponent(projectId)}/tasks?limit=${MAX_PAGE_SIZE}`,
  );

  return result.ok ? result.data : [];
}

/** `POST /projects/:projectId/tasks`. The server allocates `number`. */
export async function createTask(
  projectId: string,
  input: TaskInput,
): Promise<ActionResult<Task>> {
  const result = await apiCallWithRefresh<{ task: Task }>(
    `/projects/${encodeURIComponent(projectId)}/tasks`,
    { method: "POST", body: input },
  );

  if (!result.ok) {
    return { ok: false, code: result.code, fieldErrors: fieldErrorsFrom(result.details) };
  }

  return { ok: true, data: result.data.task };
}

/** `PATCH /tasks/:taskId`. Changed fields only — the API rejects `{}`. */
export async function updateTask(taskId: string, patch: TaskPatch): Promise<ActionResult<Task>> {
  const result = await apiCallWithRefresh<{ task: Task }>(
    `/tasks/${encodeURIComponent(taskId)}`,
    { method: "PATCH", body: patch },
  );

  if (!result.ok) {
    return { ok: false, code: result.code, fieldErrors: fieldErrorsFrom(result.details) };
  }

  return { ok: true, data: result.data.task };
}

/** `DELETE /tasks/:taskId`. Soft on the server; its sub-tasks become top-level. */
export async function deleteTask(taskId: string): Promise<ActionResult> {
  const result = await apiCallWithRefresh(`/tasks/${encodeURIComponent(taskId)}`, {
    method: "DELETE",
  });

  return result.ok ? { ok: true, data: undefined } : { ok: false, code: result.code };
}

/** `GET /tasks/:taskId/comments`, oldest first. */
export async function getTaskComments(taskId: string): Promise<ActionResult<TaskComment[]>> {
  const result = await apiCallWithRefresh<{ comments: TaskComment[] }>(
    `/tasks/${encodeURIComponent(taskId)}/comments`,
  );

  return result.ok
    ? { ok: true, data: result.data.comments }
    : { ok: false, code: result.code };
}

/** `POST /tasks/:taskId/comments`. */
export async function addTaskComment(
  taskId: string,
  body: string,
): Promise<ActionResult<TaskComment>> {
  const result = await apiCallWithRefresh<{ comment: TaskComment }>(
    `/tasks/${encodeURIComponent(taskId)}/comments`,
    { method: "POST", body: { body } },
  );

  return result.ok
    ? { ok: true, data: result.data.comment }
    : { ok: false, code: result.code };
}

/** `DELETE /tasks/:taskId/comments/:commentId` — the author, or a project writer. */
export async function deleteTaskComment(taskId: string, commentId: string): Promise<ActionResult> {
  const result = await apiCallWithRefresh(
    `/tasks/${encodeURIComponent(taskId)}/comments/${encodeURIComponent(commentId)}`,
    { method: "DELETE" },
  );

  return result.ok ? { ok: true, data: undefined } : { ok: false, code: result.code };
}
