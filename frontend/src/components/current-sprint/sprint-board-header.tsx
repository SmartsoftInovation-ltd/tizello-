"use client";

import { SprintProgress } from "@/components/current-sprint/sprint-progress";
import { CalendarIcon } from "@/components/ui/app-icons";
import { Button } from "@/components/ui/button";
import { FlagIcon, PencilIcon, PlusIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/format-date";
import type { PointsByGroup } from "@/lib/sprint-plan";
import type { ProjectSprint } from "@/types/project-sprint";

/**
 * The running sprint as ONE card above its columns: identity and actions on
 * the top row, and the progress strip — work, time, live countdown — below a
 * hairline (`sprint-progress.tsx`).
 *
 * The identity reads as a single line where it fits — name, Active pill, dates,
 * task count — with the goal under it, so the card stays short and the columns
 * keep the height. The project picker leads the action row, beside Statuses.
 *
 * Statuses and New task are quiet buttons; Complete sprint is the one brand
 * fill. Each is absent, not disabled, for someone who may not use it.
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
  return (
    <section aria-label={sprint.name} className="mt-4 shrink-0 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="truncate text-base font-semibold tracking-tight text-text">{sprint.name}</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2 py-0.5 text-2xs font-semibold text-brand-800">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-500" />
              Active
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
              <CalendarIcon className="size-3.5 text-text-subtle" />
              {sprint.startDate && sprint.endDate ? `${formatDate(sprint.startDate)} – ${formatDate(sprint.endDate)}` : "No dates set"}
            </span>
            <span className="rounded-full bg-surface-hover px-2 py-0.5 text-2xs font-semibold text-text-muted tabular-nums">
              {count === 1 ? "1 task" : `${count} tasks`}
            </span>
          </div>
          {sprint.goal && (
            <p className="mt-1 max-w-prose truncate text-xs text-text-muted">
              <span className="font-semibold text-text-subtle">Goal</span> · {sprint.goal}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

      <div className="mt-3 border-t border-border pt-3">
        <SprintProgress points={points} capacity={sprint.capacityPoints} startDate={sprint.startDate} endDate={sprint.endDate} today={today} />
      </div>
    </section>
  );
}
