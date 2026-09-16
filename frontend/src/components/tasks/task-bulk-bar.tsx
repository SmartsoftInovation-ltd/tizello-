"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PRIORITY_CHIP } from "@/components/projects/project-tone";
import { memberName, type TaskScope } from "@/components/tasks/task-draft";
import { TaskBulkDeleteDialog } from "@/components/tasks/task-bulk-delete-dialog";
import { TaskBulkMenu, type BulkOption } from "@/components/tasks/task-bulk-menu";
import { STATUS_DOT } from "@/components/tasks/task-tone";
import { TaskTypeIcon } from "@/components/tasks/task-type-icon";
import { Button } from "@/components/ui/button";
import { CloseIcon, TrashIcon } from "@/components/ui/icons";
import { bulkUpdateTasksAction } from "@/lib/actions/task-bulk-actions";
import { cn } from "@/lib/cn";
import type { TaskBulkPatch } from "@/lib/task-bulk";
import { PROJECT_PRIORITIES, PROJECT_PRIORITY_LABEL, type ProjectPriority } from "@/types/project";
import { TASK_TYPES, TASK_TYPE_LABEL, taskErrorCopy, type TaskType } from "@/types/task";

/**
 * The bar that appears once any task is selected: how many, what to set on all
 * of them, delete, and clear.
 *
 * STICKY TO THE BOTTOM of the backlog, so it stays in reach while the person
 * scrolls to select more — a bar at the top would scroll away from the rows
 * being picked. Every write is one request for the whole selection, and the
 * API applies it all-or-nothing, so a failure never leaves half a selection
 * changed without saying so.
 *
 * Sprint moves the selection into a sprint or back to the backlog in one
 * request — planning twenty tasks without twenty drags.
 *
 * Status offers EVERY status, not just To-do ones: moving a batch to "In
 * progress" is a normal grooming action, and those tasks then leave this
 * backlog exactly as a single task does.
 */
export function TaskBulkBar({
  selectedIds,
  scope,
  onClear,
}: {
  selectedIds: string[];
  scope: TaskScope;
  onClear: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const count = selectedIds.length;

  function apply(patch: TaskBulkPatch, label: string) {
    startTransition(async () => {
      const result = await bulkUpdateTasksAction(scope.workspaceId, scope.projectId, selectedIds, patch);
      if (result.code) {
        toast.error(`Nothing changed. ${taskErrorCopy(result.code)}`);
        return;
      }
      toast.success(`${label} on ${count} ${count === 1 ? "task" : "tasks"}.`);
    });
  }

  const statusOptions: BulkOption[] = scope.statuses.map((status) => ({
    value: status.id,
    label: status.name,
    adornment: <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[status.color])} />,
  }));
  const priorityOptions: BulkOption[] = [
    ...PROJECT_PRIORITIES.map((value) => ({
      value,
      label: PROJECT_PRIORITY_LABEL[value],
      adornment: <span aria-hidden="true" className={cn("size-3 shrink-0 rounded-xs", PRIORITY_CHIP[value])} />,
    })),
    { value: "", label: "No priority" },
  ];
  const assigneeOptions: BulkOption[] = [
    { value: "", label: "Unassigned" },
    ...scope.members.map((member) => ({ value: member.userId, label: memberName(member) })),
  ];
  const sprintOptions: BulkOption[] = [
    { value: "", label: "Backlog" },
    ...scope.sprints
      .filter((sprint) => sprint.state !== "COMPLETED")
      .map((sprint) => ({ value: sprint.id, label: sprint.state === "ACTIVE" ? `${sprint.name} (active)` : sprint.name })),
  ];
  const typeOptions: BulkOption[] = TASK_TYPES.map((value) => ({
    value,
    label: TASK_TYPE_LABEL[value],
    adornment: <TaskTypeIcon type={value} />,
  }));

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky bottom-4 z-10 mx-auto mt-4 flex w-fit max-w-full flex-wrap items-center gap-1 rounded-md border border-border bg-surface px-2 py-1.5 shadow-overlay"
    >
      <span className="px-2 text-xs font-semibold text-text tabular-nums" aria-live="polite">
        {count} selected
      </span>
      <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />

      <TaskBulkMenu label="Sprint" options={sprintOptions} disabled={isPending} onChoose={(value) => apply({ sprintId: value || null }, value ? "Moved to sprint" : "Moved to backlog")} />
      <TaskBulkMenu label="Status" options={statusOptions} disabled={isPending} onChoose={(statusId) => apply({ statusId }, "Status set")} />
      <TaskBulkMenu label="Priority" options={priorityOptions} disabled={isPending} onChoose={(value) => apply({ priority: (value || null) as ProjectPriority | null }, "Priority set")} />
      <TaskBulkMenu label="Assignee" options={assigneeOptions} disabled={isPending} onChoose={(value) => apply({ assigneeIds: value ? [value] : [] }, value ? "Assignee set" : "Assignees removed")} />
      <TaskBulkMenu label="Type" options={typeOptions} disabled={isPending} onChoose={(value) => apply({ type: value as TaskType }, "Type set")} />

      <Button size="sm" variant="outline" disabled={isPending} onClick={() => setConfirmDelete(true)} className="ml-1">
        <TrashIcon className="size-3.5" />
        Delete
      </Button>
      <button
        type="button"
        aria-label="Clear selection"
        onClick={onClear}
        className="grid size-7 place-items-center rounded-sm text-text-subtle transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
      >
        <CloseIcon className="size-3.5" />
      </button>

      <TaskBulkDeleteDialog
        open={confirmDelete}
        taskIds={selectedIds}
        scope={scope}
        onClose={() => setConfirmDelete(false)}
        onDeleted={onClear}
      />
    </div>
  );
}
