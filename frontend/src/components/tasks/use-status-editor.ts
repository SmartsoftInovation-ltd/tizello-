"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { TaskScope } from "@/components/tasks/task-draft";
import {
  createTaskStatusAction,
  deleteTaskStatusAction,
  reorderTaskStatusesAction,
  updateTaskStatusAction,
  type TaskStatusFormState,
} from "@/lib/actions/task-status-actions";
import { applyOrder, sortStatuses } from "@/lib/task-status-order";
import {
  taskErrorCopy,
  type StatusColor,
  type TaskStatusGroup,
  type TaskStatusOption,
} from "@/types/task";

/**
 * The status editor's list, and the four writes that change it.
 *
 * A LOCAL COPY, unlike the backlog's task list, because a drag has to redraw
 * the moment it is dropped and the editor is open for a sequence of edits, not
 * one. Each write is reconciled against what the API returns: a reorder draws
 * the new order at once and falls back to the previous one if it fails; the
 * others update once the server has answered.
 *
 * Every write also revalidates the backlog, so the sections behind the dialog
 * are already right when it closes.
 */
export function useStatusEditor(scope: TaskScope) {
  const [statuses, setStatuses] = useState(scope.statuses);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const { workspaceId, projectId } = scope;

  function run(write: () => Promise<TaskStatusFormState>, apply: (result: TaskStatusFormState) => void, undo?: () => void) {
    startTransition(async () => {
      const result = await write();

      if (result.fieldErrors || result.code) {
        undo?.();
        const message = result.fieldErrors?.name ?? taskErrorCopy(result.code ?? "VALIDATION_ERROR");
        setError(message);
        toast.error(message);
        return;
      }

      setError(undefined);
      apply(result);
    });
  }

  function reorder(order: { id: string; group: TaskStatusGroup }[]) {
    const previous = statuses;
    setStatuses(applyOrder(statuses, order));
    run(
      () => reorderTaskStatusesAction(workspaceId, projectId, order),
      (result) => result.statuses && setStatuses(result.statuses),
      () => setStatuses(previous),
    );
  }

  /** `onCreated` receives the saved status — the drawer's menu selects it for the task. */
  function create(
    group: TaskStatusGroup,
    name: string,
    color: StatusColor,
    onCreated?: (status: TaskStatusOption) => void,
  ) {
    run(
      () => createTaskStatusAction(workspaceId, projectId, { name, group, color }),
      (result) => {
        const created = result.status;
        if (!created) return;
        setStatuses((current) => sortStatuses([...current, created]));
        onCreated?.(created);
      },
    );
  }

  function update(statusId: string, patch: { name?: string; color?: StatusColor; isDefault?: true }) {
    run(
      () => updateTaskStatusAction(workspaceId, projectId, statusId, patch),
      (result) => {
        const updated = result.status;
        if (!updated) return;
        setStatuses((current) =>
          current.map((status) =>
            status.id === updated.id
              ? updated
              : patch.isDefault
                ? { ...status, isDefault: false }
                : status,
          ),
        );
      },
    );
  }

  function remove(status: TaskStatusOption, onDone: () => void) {
    run(
      () => deleteTaskStatusAction(workspaceId, projectId, status.id),
      () => {
        setStatuses((current) => current.filter((entry) => entry.id !== status.id));
        toast.success(
          status.taskCount > 0
            ? `${status.name} deleted. Its ${status.taskCount} task${status.taskCount === 1 ? "" : "s"} moved to the default status.`
            : `${status.name} deleted.`,
        );
        onDone();
      },
    );
  }

  return { statuses, isPending, error, reorder, create, update, remove };
}
