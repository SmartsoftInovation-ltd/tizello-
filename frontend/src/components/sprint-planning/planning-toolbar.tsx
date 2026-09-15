"use client";

import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";
import { plural } from "@/lib/plural";

/**
 * The planning screen's action row: a count on the left; the project picker
 * and Create sprint on the right.
 *
 * The count says where the work is — planned into sprints vs. waiting — which
 * is the one number a planning session keeps glancing at.
 *
 * WHAT IS NOT HERE, on purpose:
 * - **Statuses.** Editing the project's workflow is not a planning decision; it
 *   stays on the backlog screen.
 * - **New task.** A toolbar "New task" on a screen of sprint boxes left people
 *   asking where it would land. Every box has its own "+ Add task to …" row,
 *   and a sprint's ⋯ menu opens the full form already set to that sprint.
 *
 * CREATE SPRINT IS THE PRIMARY (brand-filled) button — it is the one action this
 * screen exists to start from. The project picker sits beside it, because which
 * project you are planning is the other decision made before any drag.
 *
 * Create sprint is ABSENT, not disabled, for anyone who is not a project writer.
 */
export function PlanningToolbar({
  planned,
  waiting,
  canManage,
  actions,
  onCreateSprint,
}: {
  planned: number;
  waiting: number;
  canManage: boolean;
  /** Drawn before Create sprint — the project picker on `/board/sprint-planning`. */
  actions?: React.ReactNode;
  onCreateSprint: () => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p className="text-xs text-text-subtle">
        <span className="font-semibold text-text">{plural(planned, "task", "tasks")} planned</span>
        {" · "}
        {waiting} waiting in the backlog
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        {actions}
        {canManage && (
          <Button size="sm" onClick={onCreateSprint}>
            <PlusIcon className="size-3.5" />
            Create sprint
          </Button>
        )}
      </div>
    </div>
  );
}
