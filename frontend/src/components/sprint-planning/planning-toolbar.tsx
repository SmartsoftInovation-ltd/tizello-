"use client";

import { Button } from "@/components/ui/button";
import { PencilIcon, PlusIcon } from "@/components/ui/icons";
import { plural } from "@/lib/plural";

/**
 * The planning screen's action row — the same anatomy as the backlog's
 * `TaskBacklogToolbar`, so the two screens a team moves between read as one
 * tool: a count on the left; Statuses, Create sprint and New task on the right.
 *
 * The count says where the work is — planned into sprints vs. waiting — which
 * is the one number a planning session keeps glancing at.
 *
 * Every action is ABSENT, not disabled, for someone who may not use it:
 * Statuses and Create sprint for anyone who is not a project writer, New task
 * for a workspace member who is not on the project.
 */
export function PlanningToolbar({
  planned,
  waiting,
  canManage,
  canCreate,
  onEditStatuses,
  onCreateSprint,
  onNewTask,
}: {
  planned: number;
  waiting: number;
  canManage: boolean;
  canCreate: boolean;
  onEditStatuses: () => void;
  onCreateSprint: () => void;
  onNewTask: () => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p className="text-xs text-text-subtle">
        <span className="font-semibold text-text">{plural(planned, "task", "tasks")} planned</span>
        {" · "}
        {waiting} waiting in the backlog
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        {canManage && (
          <Button size="sm" variant="outline" onClick={onEditStatuses}>
            <PencilIcon className="size-3.5" />
            Statuses
          </Button>
        )}
        {canManage && (
          <Button size="sm" variant="outline" onClick={onCreateSprint}>
            <PlusIcon className="size-3.5" />
            Create sprint
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
