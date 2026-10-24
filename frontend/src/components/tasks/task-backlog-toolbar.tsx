"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PencilIcon, PlusIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * Statuses and New task on the right; an optional `leading` slot on the left.
 *
 * `/board/backlog` puts its sprint-workflow tabs in `leading`, their underline
 * sitting on this row's rule. `actions` goes in front of Statuses — the
 * project picker. The task count is NOT here any more: it lives at the end of
 * the filter row (`task-backlog-summary.tsx`), so the page states it once.
 *
 * Search and filters are NOT here: they sit on their own row below
 * (`task-backlog-filters.tsx`), because this row's two slots already hold the
 * workflow tabs and the project picker on `/board/backlog`. There is no sort
 * control — the order IS the rank the team dragged, and a sort that overrode
 * it would make dragging look broken.
 *
 * Both actions are absent, not disabled, for someone who may not use them:
 * Statuses for anyone who is not a project writer, New task for a workspace
 * member who is not on the project.
 */
export function TaskBacklogToolbar({
  canCreate,
  onNewTask,
  onEditStatuses,
  leading,
  actions,
}: {
  canCreate: boolean;
  onNewTask: () => void;
  onEditStatuses?: () => void;
  leading?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-wrap justify-between gap-x-4 gap-y-2 border-b border-border",
        leading ? "items-end" : "items-center pb-2",
      )}
    >
      <div className="min-w-0">{leading}</div>

      <div className={cn("flex flex-wrap items-center gap-1.5", leading ? "pb-2" : undefined)}>
        {actions}
        {onEditStatuses && (
          <Button size="sm" variant="outline" onClick={onEditStatuses}>
            <PencilIcon className="size-3.5" />
            Statuses
          </Button>
        )}
        {canCreate && (
          <Button size="sm" onClick={onNewTask}>
            <PlusIcon className="size-3.5" />
            New task
          </Button>
        )}
      </div>
    </div>
  );
}
