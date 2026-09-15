"use client";

import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";
import { plural } from "@/lib/plural";

/**
 * The planning screen's action row — the same anatomy as the backlog's
 * `TaskBacklogToolbar`, so the two screens a team moves between read as one
 * tool: a count on the left; Create sprint and New backlog task on the right.
 *
 * No Statuses button here, unlike the backlog. Editing the project's workflow
 * is not a planning decision, and a third outline button beside the two that
 * are made the row read as a settings bar. It stays on the backlog screen.
 *
 * "New BACKLOG task", not "New task": on a screen of sprint boxes, a bare
 * "New task" left people asking where it would land. It lands in the backlog
 * (the drawer's Sprint field can still change that); the "+ Add task to …" row
 * under each box is the way to file straight into that box.
 *
 * The count says where the work is — planned into sprints vs. waiting — which
 * is the one number a planning session keeps glancing at.
 *
 * Every action is ABSENT, not disabled, for someone who may not use it:
 * Create sprint for anyone who is not a project writer, New backlog task for a
 * workspace member who is not on the project.
 */
export function PlanningToolbar({
  planned,
  waiting,
  canManage,
  canCreate,
  onCreateSprint,
  onNewTask,
}: {
  planned: number;
  waiting: number;
  canManage: boolean;
  canCreate: boolean;
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
          <Button size="sm" variant="outline" onClick={onCreateSprint}>
            <PlusIcon className="size-3.5" />
            Create sprint
          </Button>
        )}
        {canCreate && (
          <Button size="sm" onClick={onNewTask}>
            <PlusIcon className="size-3.5" />
            New backlog task
          </Button>
        )}
      </div>
    </div>
  );
}
