"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { TaskScope } from "@/components/tasks/task-draft";
import { TaskStatusAddForm } from "@/components/tasks/task-status-add-form";
import { PlusIcon } from "@/components/ui/icons";
import { createTaskStatusAction } from "@/lib/actions/task-status-actions";
import { cn } from "@/lib/cn";
import { TASK_STATUS_GROUP_LABEL, TASK_STATUS_GROUPS, taskErrorCopy, type StatusColor, type TaskStatusGroup } from "@/types/task";

/**
 * The column after the last one: "+ Add status", which opens the same card the
 * status editor uses (name, colour, live preview) plus a choice of GROUP.
 *
 * The group is asked for because it is what a status MEANS to the server — a
 * card entering a Complete-group column is stamped finished, and the sprint's
 * points split by group. "Review" is In Progress, "Shipped" is Complete; the
 * name alone cannot say which. It defaults to In Progress, where new columns
 * on a sprint board almost always go.
 *
 * The new column appears where its group sorts, not necessarily at the end —
 * the board draws statuses in the editor's order. Project writers only.
 */
export function AddStatusColumn({ scope }: { scope: TaskScope }) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<TaskStatusGroup>("IN_PROGRESS");
  const [isPending, startTransition] = useTransition();

  function add(name: string, color: StatusColor) {
    startTransition(async () => {
      const result = await createTaskStatusAction(scope.workspaceId, scope.projectId, { name, color, group });
      if (result.code || result.fieldErrors) {
        toast.error(result.fieldErrors?.name ?? taskErrorCopy(result.code ?? "VALIDATION_ERROR"));
        return;
      }
      toast.success(`Added the ${name} column`);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-list shrink-0 self-start items-center gap-1.5 rounded-lg border border-dashed border-border-strong bg-surface-hover px-3 text-sm font-medium text-text-muted transition-colors duration-100 ease-standard hover:bg-surface-sunken hover:text-text"
      >
        <PlusIcon className="size-4" />
        Add status
      </button>
    );
  }

  return (
    <section aria-label="Add a status" className="scrollbar-board max-h-full w-list shrink-0 self-start overflow-y-auto rounded-lg border border-border bg-panel p-1.5">
      <p className="px-1.5 pt-1 text-2xs font-semibold tracking-widest text-text-subtle uppercase">Group</p>
      <div role="radiogroup" aria-label="Status group" className="flex gap-1 px-1 pt-1.5 pb-2">
        {TASK_STATUS_GROUPS.map((choice) => (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={group === choice}
            onClick={() => setGroup(choice)}
            className={cn(
              "h-7 flex-1 rounded-sm border px-1 text-2xs font-semibold transition-colors duration-100 ease-standard",
              group === choice
                ? "border-brand-500 bg-brand-100 text-brand-800"
                : "border-transparent bg-surface-hover text-text-muted hover:bg-surface-sunken hover:text-text",
            )}
          >
            {TASK_STATUS_GROUP_LABEL[choice]}
          </button>
        ))}
      </div>
      <TaskStatusAddForm key={group} group={group} pending={isPending} onAdd={add} onCancel={() => setOpen(false)} />
    </section>
  );
}
