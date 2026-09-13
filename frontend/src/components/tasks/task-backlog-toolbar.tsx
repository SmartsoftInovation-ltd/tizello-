"use client";

import { Button } from "@/components/ui/button";
import { PencilIcon, PlusIcon } from "@/components/ui/icons";
import { plural } from "@/lib/plural";

/**
 * The count on the left; Statuses and New task on the right.
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
}: {
  count: number;
  subtaskCount: number;
  canCreate: boolean;
  onNewTask: () => void;
  onEditStatuses?: () => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
      <p className="text-xs text-text-subtle">
        <span className="font-semibold text-text">{plural(count, "task", "tasks")}</span>
        {subtaskCount > 0 && <> &middot; {plural(subtaskCount, "sub-task", "sub-tasks")}</>}
      </p>

      <div className="flex items-center gap-1.5">
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
