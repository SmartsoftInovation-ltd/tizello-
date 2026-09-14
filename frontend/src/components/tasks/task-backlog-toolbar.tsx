"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PencilIcon, PlusIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/plural";

/**
 * The count on the left; Statuses and New task on the right.
 *
 * Two optional slots for the page that owns the toolbar. `leading` takes the
 * left side — `/board/backlog` puts its sprint-workflow tabs there, their
 * underline sitting on this row's rule, and the count drops to its own line
 * below. `actions` goes in front of Statuses — the project picker.
 *
 * No filter, sort or search controls — not even locked ones. On a real backlog
 * grouped by status they were promises nobody had scheduled, and a disabled
 * button is still a button someone tries.
 *
 * Both actions are absent, not disabled, for someone who may not use them:
 * Statuses for anyone who is not a project writer, New task for a workspace
 * member who is not on the project.
 */
export function TaskBacklogToolbar({
  count,
  subtaskCount,
  canCreate,
  onNewTask,
  onEditStatuses,
  leading,
  actions,
}: {
  count: number;
  subtaskCount: number;
  canCreate: boolean;
  onNewTask: () => void;
  onEditStatuses?: () => void;
  leading?: ReactNode;
  actions?: ReactNode;
}) {
  const summary = (
    <p className="text-xs text-text-subtle">
      <span className="font-semibold text-text">{plural(count, "task", "tasks")}</span>
      {subtaskCount > 0 && <> &middot; {plural(subtaskCount, "sub-task", "sub-tasks")}</>}
    </p>
  );

  return (
    <>
      <div
        className={cn(
          "mt-6 flex flex-wrap justify-between gap-x-4 gap-y-2 border-b border-border",
          leading ? "items-end" : "items-center pb-2",
        )}
      >
        {leading ? <div className="min-w-0">{leading}</div> : summary}

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

      {leading && <div className="mt-3">{summary}</div>}
    </>
  );
}
