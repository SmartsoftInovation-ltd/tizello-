"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createTaskAction,
  updateTaskAction,
  type TaskFormState,
} from "@/lib/actions/task-actions";
import {
  createInput,
  draftFromTask,
  taskPatch,
  type TaskDraft,
  type TaskScope,
} from "@/components/tasks/task-draft";
import { defaultStatusId } from "@/lib/task-status-order";
import type { ProjectPropertyPatch } from "@/types/project-property";
import { taskErrorCopy, type Task } from "@/types/task";

/**
 * Everything the task drawer holds, and what Save does with it.
 *
 * One hook for create and edit, because the drawer is one form: the only
 * difference is whether there is a stored task to diff against. Seeded at
 * MOUNT — `TaskDrawer` remounts the form on every open, so there is no effect
 * syncing props into state.
 *
 * The write is called inside `startTransition` and branched on right there, so
 * closing on success needs no effect watching for it — the same arrangement as
 * `create-project-form.tsx`.
 */
export function useTaskForm({
  task,
  scope,
  parentId,
  sprintId,
  onClose,
}: {
  task: Task | null;
  scope: TaskScope;
  /** Seeds Parent-task when the drawer was opened to add a sub-task. */
  parentId?: string;
  /** Seeds Sprint when the drawer was opened from a sprint. */
  sprintId?: string;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<TaskDraft>(() =>
    draftFromTask(task, { parentId, sprintId, statusId: defaultStatusId(scope.statuses) }),
  );
  const [properties, setProperties] = useState<ProjectPropertyPatch>(
    () => task?.properties ?? {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function change(patch: Partial<TaskDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors({});
  }

  function changeProperties(patch: ProjectPropertyPatch) {
    setProperties((current) => ({ ...current, ...patch }));
  }

  function run(write: () => Promise<TaskFormState>, success: string) {
    startTransition(async () => {
      const result = await write();

      if (result.fieldErrors) {
        setErrors(result.fieldErrors);
        return;
      }
      if (result.code) {
        toast.error(taskErrorCopy(result.code));
        return;
      }

      toast.success(success);
      onClose();
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = draft.title.trim();
    if (!title) {
      setErrors({ title: "Give the task a title." });
      return;
    }

    if (!task) {
      run(
        () =>
          createTaskAction(scope.workspaceId, scope.projectId, createInput(draft, properties)),
        `${title} is in ${scope.sprints.find((sprint) => sprint.id === draft.sprintId)?.name ?? "the backlog"}.`,
      );
      return;
    }

    /* An untouched drawer closes without a request — the API answers `{}` with
       a `400`, and a Save that changed nothing should not bump `updatedAt`. */
    const patch = taskPatch(task, draft, properties);
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    run(
      () => updateTaskAction(scope.workspaceId, scope.projectId, task.id, patch),
      `${task.key} updated.`,
    );
  }

  return { draft, properties, errors, isPending, change, changeProperties, submit };
}
