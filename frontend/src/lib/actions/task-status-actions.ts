"use server";

import { revalidateBacklog } from "@/lib/actions/revalidate-backlog";
import {
  createTaskStatus,
  deleteTaskStatus,
  reorderTaskStatuses,
  updateTaskStatus,
} from "@/lib/task-statuses";
import type { StatusColor, TaskStatusGroup, TaskStatusOption } from "@/types/task";

/*
 * Writes to a project's Status property. Thin by rule: call `lib/task-statuses.ts`,
 * revalidate both backlog routes. Every one lands immediately — a status
 * belongs to every task in the project, not to whichever drawer is open.
 *
 * Permissions are the API's (`requireProjectWrite`); a `403` comes back as
 * `code: "FORBIDDEN"`.
 */

export type TaskStatusFormState = {
  code?: string;
  fieldErrors?: Record<string, string>;
  status?: TaskStatusOption;
  statuses?: TaskStatusOption[];
};

const NAME_MAX = 40;

function nameError(name: string): string | undefined {
  if (!name) return "Give the status a name.";
  return name.length > NAME_MAX ? `Keep it under ${NAME_MAX} characters.` : undefined;
}

export async function createTaskStatusAction(
  workspaceId: string,
  projectId: string,
  input: { name: string; color: StatusColor; group: TaskStatusGroup },
): Promise<TaskStatusFormState> {
  const name = input.name.trim();
  const invalid = nameError(name);
  if (invalid) return { fieldErrors: { name: invalid } };

  const result = await createTaskStatus(projectId, { ...input, name });
  if (!result.ok) return { code: result.code, fieldErrors: result.fieldErrors };

  revalidateBacklog(workspaceId, projectId);
  return { status: result.data };
}

export async function updateTaskStatusAction(
  workspaceId: string,
  projectId: string,
  statusId: string,
  patch: { name?: string; color?: StatusColor; isDefault?: true },
): Promise<TaskStatusFormState> {
  if (patch.name !== undefined) {
    const invalid = nameError(patch.name.trim());
    if (invalid) return { fieldErrors: { name: invalid } };
  }

  const result = await updateTaskStatus(projectId, statusId, {
    ...patch,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
  });
  if (!result.ok) return { code: result.code, fieldErrors: result.fieldErrors };

  revalidateBacklog(workspaceId, projectId);
  return { status: result.data };
}

export async function reorderTaskStatusesAction(
  workspaceId: string,
  projectId: string,
  order: { id: string; group: TaskStatusGroup }[],
): Promise<TaskStatusFormState> {
  const result = await reorderTaskStatuses(projectId, order);
  if (!result.ok) return { code: result.code };

  revalidateBacklog(workspaceId, projectId);
  return { statuses: result.data };
}

export async function deleteTaskStatusAction(
  workspaceId: string,
  projectId: string,
  statusId: string,
): Promise<TaskStatusFormState> {
  const result = await deleteTaskStatus(projectId, statusId);
  if (!result.ok) return { code: result.code };

  revalidateBacklog(workspaceId, projectId);
  return {};
}
