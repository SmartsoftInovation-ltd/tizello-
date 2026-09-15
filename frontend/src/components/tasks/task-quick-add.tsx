"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { TaskScope } from "@/components/tasks/task-draft";
import { PlusIcon } from "@/components/ui/icons";
import { createTaskAction } from "@/lib/actions/task-actions";
import { taskErrorCopy, type TaskStatusOption } from "@/types/task";

/**
 * "+ Add task" under a status: type a title, press Enter, it is in the backlog.
 *
 * The fast path the drawer is not. Getting ten thoughts out of someone's head
 * should be ten titles and ten Enters, not ten drawers — everything else about
 * a task is filled in later. The composer STAYS OPEN and keeps focus after a
 * create for exactly that reason; Escape or Done closes it.
 *
 * It files into THIS status, not the project default, because that is the
 * section it is drawn under. The new task lands at the bottom (the API ranks
 * new arrivals last), which is right under the composer the person is looking
 * at.
 *
 * A real `<form>`: the backlog is not inside the drawer's form, so Enter can be
 * a native submit here.
 */
export function TaskQuickAdd({ status, scope }: { status: TaskStatusOption; scope: TaskScope }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-text-subtle transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
      >
        <PlusIcon className="size-3.5" />
        Add task
        <span className="sr-only"> to {status.name}</span>
      </button>
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = title.trim();
    if (!value || isPending) return;

    startTransition(async () => {
      const result = await createTaskAction(scope.workspaceId, scope.projectId, {
        title: value,
        statusId: status.id,
      });

      if (result.code || result.fieldErrors) {
        toast.error(result.fieldErrors?.title ?? taskErrorCopy(result.code ?? "VALIDATION_ERROR"));
        return;
      }
      setTitle("");
    });
  }

  return (
    <form onSubmit={submit} className="mt-1.5 flex items-center gap-2 rounded-md border border-border bg-surface p-1.5">
      <input
        autoFocus
        aria-label={`New task title in ${status.name}`}
        placeholder="Task title, then Enter"
        value={title}
        maxLength={200}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
        className="h-8 min-w-0 flex-1 rounded-sm border-0 bg-transparent px-1.5 text-sm text-text placeholder:text-text-subtle focus-visible:outline-none"
      />
      <button
        type="submit"
        disabled={isPending || !title.trim()}
        className="rounded-sm bg-brand-500 px-3 py-1.5 text-xs font-semibold text-on-brand transition-colors duration-100 ease-standard hover:bg-brand-400 disabled:opacity-60"
      >
        {isPending ? "Adding…" : "Add"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-sm px-2 py-1.5 text-xs text-text-muted transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
      >
        Done
      </button>
    </form>
  );
}
