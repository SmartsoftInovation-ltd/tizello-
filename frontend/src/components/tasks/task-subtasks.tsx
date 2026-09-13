"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { TaskScope } from "@/components/tasks/task-draft";
import { STATUS_DOT } from "@/components/tasks/task-tone";
import { PlusIcon } from "@/components/ui/icons";
import { createTaskAction } from "@/lib/actions/task-actions";
import { cn } from "@/lib/cn";
import { taskErrorCopy, type Task } from "@/types/task";

/**
 * Relations: this task's sub-tasks, and a way to add one.
 *
 * A SUB-TASK IS A TASK. It has its own key, status, assignee and drawer — the
 * only thing that makes it a sub-task is `parentId`. So adding one here is a
 * real `POST` that lands immediately (holding it behind the parent's Save would
 * be a task that exists only in a drawer), and clicking one opens it in this
 * same panel.
 *
 * The list is read from the page's task list rather than fetched: the backlog
 * already has every task in the project, and the action's `revalidatePath` is
 * what brings a new sub-task into it.
 *
 * No `<form>` for the composer — this renders inside the drawer's form, and a
 * nested form is invalid HTML. Enter is caught by hand instead.
 */
export function TaskSubtasks({
  task,
  tasks,
  scope,
  onOpenTask,
}: {
  task: Task;
  tasks: Task[];
  scope: TaskScope;
  onOpenTask: (taskId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();
  const subtasks = tasks.filter((entry) => entry.parentId === task.id);

  function add() {
    const value = title.trim();
    if (!value) return;

    startTransition(async () => {
      const result = await createTaskAction(scope.workspaceId, scope.projectId, {
        title: value,
        parentId: task.id,
      });

      if (result.code || result.fieldErrors) {
        toast.error(result.fieldErrors?.title ?? taskErrorCopy(result.code ?? "VALIDATION_ERROR"));
        return;
      }
      setTitle("");
    });
  }

  return (
    <section className="mt-6 border-t border-border pt-4" aria-label="Relations">
      <h3 className="px-0.5 text-xs font-medium text-text-subtle">Relations</h3>

      {subtasks.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {subtasks.map((subtask) => (
            <li key={subtask.id}>
              <button
                type="button"
                onClick={() => onOpenTask(subtask.id)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors duration-100 ease-standard hover:bg-surface-hover"
              >
                <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[subtask.status.color])} title={subtask.status.name} />
                <span className="shrink-0 font-mono text-2xs text-text-subtle">{subtask.key}</span>
                <span className={cn("min-w-0 flex-1 truncate text-sm", subtask.status.group === "COMPLETE" ? "text-text-subtle line-through" : "text-text")}>
                  {subtask.title}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {scope.canContribute && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-1 flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs text-text-subtle transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
        >
          <PlusIcon className="size-3.5" />
          Add sub-task
        </button>
      )}

      {scope.canContribute && adding && (
        <div className="mt-2 flex items-center gap-2 px-0.5">
          <input
            autoFocus
            aria-label="Sub-task title"
            placeholder="Sub-task title"
            value={title}
            maxLength={200}
            disabled={isPending}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              } else if (event.key === "Escape") {
                /* Esc would otherwise close the whole drawer. */
                event.preventDefault();
                setAdding(false);
              }
            }}
            className="h-8 min-w-0 flex-1 rounded-sm border border-border bg-surface px-2.5 text-sm text-text placeholder:text-text-subtle"
          />
          <button
            type="button"
            disabled={isPending || !title.trim()}
            onClick={add}
            className="rounded-sm bg-brand-500 px-3 py-1.5 text-xs font-semibold text-on-brand transition-colors duration-100 ease-standard hover:bg-brand-400 disabled:opacity-60"
          >
            {isPending ? "Adding…" : "Add"}
          </button>
          <button type="button" onClick={() => setAdding(false)} className="rounded-sm px-2 py-1.5 text-xs text-text-muted hover:bg-surface-hover hover:text-text">
            Done
          </button>
        </div>
      )}
    </section>
  );
}
