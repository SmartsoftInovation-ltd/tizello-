import { apiCallWithRefresh } from "@/lib/api-client";
import { fieldErrorsFrom } from "@/lib/field-errors";
import type { ActionResult } from "@/lib/workspaces";
import type { StatusColor, TaskStatusGroup, TaskStatusOption } from "@/types/task";

/*
 * A project's Status property — `backend/docs/api/task.md` §*Statuses*.
 *
 * Reads are open to anyone who can see the project; every write is
 * project-writer-only, like task columns. Reordering is ONE full-list `PUT`
 * rather than a move per drag: a drop is then a single atomic, idempotent
 * request, and two quick drags can never leave half an order behind.
 */

const base = (projectId: string) =>
  `/projects/${encodeURIComponent(projectId)}/task-statuses`;

/** `GET .../task-statuses` — ordered by group, then position. Seeds the three defaults on first read. */
export async function getTaskStatuses(projectId: string): Promise<TaskStatusOption[]> {
  const result = await apiCallWithRefresh<{ statuses: TaskStatusOption[] }>(base(projectId));

  return result.ok ? result.data.statuses : [];
}

export async function createTaskStatus(
  projectId: string,
  input: { name: string; color: StatusColor; group: TaskStatusGroup },
): Promise<ActionResult<TaskStatusOption>> {
  const result = await apiCallWithRefresh<{ status: TaskStatusOption }>(base(projectId), {
    method: "POST",
    body: input,
  });

  if (!result.ok) {
    return { ok: false, code: result.code, fieldErrors: fieldErrorsFrom(result.details) };
  }
  return { ok: true, data: result.data.status };
}

/** `isDefault` can only be set to `true` — the API moves the flag, it never leaves a project without one. */
export async function updateTaskStatus(
  projectId: string,
  statusId: string,
  patch: { name?: string; color?: StatusColor; isDefault?: true },
): Promise<ActionResult<TaskStatusOption>> {
  const result = await apiCallWithRefresh<{ status: TaskStatusOption }>(
    `${base(projectId)}/${encodeURIComponent(statusId)}`,
    { method: "PATCH", body: patch },
  );

  if (!result.ok) {
    return { ok: false, code: result.code, fieldErrors: fieldErrorsFrom(result.details) };
  }
  return { ok: true, data: result.data.status };
}

/** `PUT .../task-statuses/order` — every status, once, in display order, each with its group. */
export async function reorderTaskStatuses(
  projectId: string,
  order: { id: string; group: TaskStatusGroup }[],
): Promise<ActionResult<TaskStatusOption[]>> {
  const result = await apiCallWithRefresh<{ statuses: TaskStatusOption[] }>(
    `${base(projectId)}/order`,
    { method: "PUT", body: { statuses: order } },
  );

  return result.ok
    ? { ok: true, data: result.data.statuses }
    : { ok: false, code: result.code };
}

/** `DELETE .../task-statuses/:id` — its tasks move to the default status server-side. */
export async function deleteTaskStatus(projectId: string, statusId: string): Promise<ActionResult> {
  const result = await apiCallWithRefresh(`${base(projectId)}/${encodeURIComponent(statusId)}`, {
    method: "DELETE",
  });

  return result.ok ? { ok: true, data: undefined } : { ok: false, code: result.code };
}
