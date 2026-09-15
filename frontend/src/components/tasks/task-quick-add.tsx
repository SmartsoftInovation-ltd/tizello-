"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { TaskScope } from "@/components/tasks/task-draft";
import { PlusIcon } from "@/components/ui/icons";
import { createTaskAction } from "@/lib/actions/task-actions";
import { taskErrorCopy } from "@/types/task";

/**
 * "+ Add task to …" under a box: type a title, press Enter, it is there.
 *
 * THE DESTINATION IS IN THE LABEL, and the row is a brand-tinted dashed box.
 * A bare "Add task" under every box read as the same button repeated — people
 * could not tell it from the toolbar's New task, or which box it filed into.
 * "Add task to Sprint 1" answers that before the click, and the dashed outline
 * is the house signal for "there is room here" (the drop zones use it too).
 * The brand hue is identical in both themes, and `text-text-brand` is the
 * AA-safe brand ink on either surface (DESIGN-SYSTEM.md).
 *
 * The fast path the drawer is not. Getting ten thoughts out of someone's head
 * should be ten titles and ten Enters, not ten drawers — everything else about
 * a task is filled in later. The composer STAYS OPEN and keeps focus after a
 * create for exactly that reason; Escape or Done closes it.
 *
 * It files into the section it is drawn under — a status on the backlog, a
 * sprint (or the backlog) on the planning screen — because that is where the
 * person is looking. The new task lands at the bottom (the API ranks
 * new arrivals last), which is right under the composer the person is looking
 * at.
 *
 * A real `<form>`: the backlog is not inside the drawer's form, so Enter can be
 * a native submit here.
 */
export function TaskQuickAdd({
  scope,
  where,
  statusId,
  sprintId,
}: {
  scope: TaskScope;
  /** The section's name, for the accessible labels — "Not Started", "ECS Sprint 2". */
  where: string;
  statusId?: string;
  /** A sprint id; omitted or `null` files into the backlog. */
  sprintId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 flex w-full items-center gap-1.5 rounded-md border border-dashed border-brand-500/70 bg-surface px-3 py-2 text-left text-xs font-semibold text-text-brand transition-colors duration-100 ease-standard hover:border-brand-500 hover:bg-success-subtle"
      >
        <PlusIcon className="size-3.5" />
        Add task to {where}
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
        ...(statusId ? { statusId } : {}),
        ...(sprintId ? { sprintId } : {}),
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
        aria-label={`New task title in ${where}`}
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
