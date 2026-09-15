"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useMenuPopover } from "@/components/projects/use-menu-popover";
import { StoryPointsChoices } from "@/components/tasks/story-points-choices";
import type { TaskScope } from "@/components/tasks/task-draft";
import { updateTaskAction } from "@/lib/actions/task-actions";
import { cn } from "@/lib/cn";
import { taskErrorCopy, type Task } from "@/types/task";

/**
 * Estimate a task straight from its row — the pill on the right of a backlog
 * or planning row, opening the 1 · 2 · 3 · 5 · 8 · 13 buttons.
 *
 * On the ROW, not only in the drawer, because estimating is what a planning
 * session does to twenty tasks in a row; opening and saving a drawer twenty
 * times is the friction that makes teams skip it.
 *
 * WRITES ON CLICK, OPTIMISTICALLY. The pill shows the new number at once; the
 * `PATCH` revalidates the page, and on a failure the server's value comes back
 * and a toast says why. Someone who may not change tasks gets a plain badge.
 */
const PANEL_HEIGHT = 96;

export function StoryPointsPicker({ task, scope }: { task: Task; scope: TaskScope }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [points, setPoints] = useOptimistic(task.storyPoints);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };
  const position = useMenuPopover({ open, triggerRef, panelRef, height: PANEL_HEIGHT, width: 300, align: "end", onDismiss: close });

  /* "Est." rather than a dash: an empty pill beside an empty assignee avatar
     read as two identical blanks, and nobody could tell which one estimates. */
  const label = points === null ? "Est." : `${points} pts`;

  if (!scope.canContribute) {
    return (
      <span title="Story points" className="grid h-6 min-w-10 place-items-center rounded-full bg-surface-sunken px-2 text-2xs font-semibold text-text-muted tabular-nums">
        {label}
      </span>
    );
  }

  function choose(next: number | null) {
    close();
    if (next === task.storyPoints) return;

    startTransition(async () => {
      setPoints(next);
      const result = await updateTaskAction(scope.workspaceId, scope.projectId, task.id, { storyPoints: next });
      if (result.code || result.fieldErrors) toast.error(`${task.key} kept its estimate. ${taskErrorCopy(result.code ?? "VALIDATION_ERROR")}`);
    });
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={points === null ? `Estimate ${task.key}` : `${task.key}: ${points} story points. Change estimate`}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "grid h-6 min-w-10 place-items-center rounded-full px-2 text-2xs font-semibold tabular-nums transition-colors duration-100 ease-standard",
          points === null
            ? "border border-dashed border-border text-text-subtle hover:border-border-strong hover:text-text"
            : "bg-surface-sunken text-text-muted hover:bg-surface-hover hover:text-text",
        )}
      >
        {label}
      </button>

      {open && (
        <div
          ref={panelRef}
          popover="manual"
          role="dialog"
          aria-label={`Story points for ${task.key}`}
          className="fixed inset-auto m-0 rounded-md border border-border bg-surface p-2 shadow-overlay"
          style={{ top: position.top, left: position.left }}
        >
          <p className="mb-1.5 text-2xs font-medium text-text-subtle">Story points</p>
          <StoryPointsChoices value={points} size="sm" onChange={choose} />
        </div>
      )}
    </>
  );
}
