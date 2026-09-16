"use client";

import { SprintPoints } from "@/components/sprint-planning/sprint-points";
import { Button } from "@/components/ui/button";
import { FlagIcon, PencilIcon, PlusIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/format-date";
import { daysRemaining } from "@/lib/sprint-dates";
import type { PointsByGroup } from "@/lib/sprint-plan";
import type { ProjectSprint } from "@/types/project-sprint";

/**
 * The running sprint's identity and controls, above its columns: name and
 * Active badge, dates and how long is left, the goal, then the points summary
 * sprint planning shows (so the two screens report a sprint identically), and
 * Statuses / New task / Complete sprint.
 *
 * Each action is absent, not disabled, for someone who may not use it:
 * Statuses and Complete for project writers, New task for contributors.
 */
export function SprintBoardHeader({
  sprint,
  count,
  points,
  today,
  canManage,
  canContribute,
  actions,
  onEditStatuses,
  onNewTask,
  onComplete,
}: {
  sprint: ProjectSprint;
  count: number;
  points: PointsByGroup;
  today: string;
  canManage: boolean;
  canContribute: boolean;
  /** The project picker. */
  actions?: React.ReactNode;
  onEditStatuses: () => void;
  onNewTask: () => void;
  onComplete: () => void;
}) {
  const left = sprint.endDate ? daysRemaining(today, sprint.endDate) : null;

  return (
    <div className="mt-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-border pb-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-base font-semibold text-text">
          <span className="truncate">{sprint.name}</span>
          <span className="rounded-xs bg-brand-100 px-1.5 py-0.5 text-2xs font-semibold text-brand-800">Active</span>
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-text-muted">
          <span>
            {sprint.startDate && sprint.endDate
              ? `${formatDate(sprint.startDate)} – ${formatDate(sprint.endDate)}`
              : "No dates set"}
          </span>
          <span aria-hidden="true">·</span>
          <span>{count === 1 ? "1 task" : `${count} tasks`}</span>
          {left !== null && (
            <>
              <span aria-hidden="true">·</span>
              <span className={left < 0 ? "font-medium text-danger" : undefined}>
                {left < 0 ? `${-left} days overdue` : left === 1 ? "last day" : `${left} days left`}
              </span>
            </>
          )}
        </p>
        {sprint.goal && <p className="mt-1 max-w-prose text-xs text-text-subtle">{sprint.goal}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SprintPoints points={points} capacity={sprint.capacityPoints} />
        {actions}
        {canManage && (
          <Button size="sm" variant="subtle" onClick={onEditStatuses}>
            <PencilIcon className="size-3.5" />
            Statuses
          </Button>
        )}
        {canContribute && (
          <Button size="sm" variant="subtle" onClick={onNewTask}>
            <PlusIcon className="size-3.5" />
            New task
          </Button>
        )}
        {canManage && (
          <Button size="sm" onClick={onComplete}>
            <FlagIcon className="size-3.5" />
            Complete sprint
          </Button>
        )}
      </div>
    </div>
  );
}
