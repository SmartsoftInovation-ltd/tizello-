"use client";

import { SprintPoints } from "@/components/sprint-planning/sprint-points";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/format-date";
import { daysRemaining } from "@/lib/sprint-dates";
import type { PointsByGroup } from "@/lib/sprint-plan";
import type { ProjectSprint } from "@/types/project-sprint";

/**
 * The right-hand side of a sprint box's header: dates, task count, points, and
 * the lifecycle action for the sprint's state — Start for one in planning,
 * Complete for the active one — plus Edit and Delete in a menu.
 *
 * START IS DISABLED, NOT HIDDEN, while another sprint runs, with the reason in
 * its `title` and beside it: one active sprint per project is a rule people
 * hit, and a button that silently vanished would read as a missing feature.
 *
 * Every action is drawn only for a project writer (`canManage`); the API's
 * `requireProjectWrite` enforces the same line.
 */
export type SprintAction = "start" | "complete" | "edit" | "delete" | "add-task";

export function SprintHeader({
  sprint,
  count,
  points,
  canManage,
  canContribute,
  today,
  blockedBy,
  onAction,
}: {
  sprint: ProjectSprint;
  count: number;
  points: PointsByGroup;
  canManage: boolean;
  canContribute: boolean;
  today: string;
  /** The name of the sprint already running, when this one cannot start. */
  blockedBy: string | null;
  onAction: (action: SprintAction) => void;
}) {
  const left = sprint.state === "ACTIVE" && sprint.endDate ? daysRemaining(today, sprint.endDate) : null;
  const dates =
    sprint.startDate && sprint.endDate
      ? `${formatDate(sprint.startDate)} – ${formatDate(sprint.endDate)}`
      : "No dates yet";

  return (
    <>
      <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-text-subtle">
        {sprint.state === "ACTIVE" && (
          <span className="rounded-xs bg-brand-100 px-1.5 py-0.5 text-2xs font-semibold text-brand-800">Active</span>
        )}
        <span>{dates}</span>
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

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <SprintPoints points={points} capacity={sprint.capacityPoints} />

        {canManage && sprint.state === "PLANNING" && (
          <Button
            size="sm"
            variant="outline"
            disabled={blockedBy !== null}
            title={blockedBy ? `${blockedBy} is still active — complete it first` : undefined}
            onClick={() => onAction("start")}
          >
            Start sprint
          </Button>
        )}
        {canManage && sprint.state === "ACTIVE" && (
          <Button size="sm" variant="outline" onClick={() => onAction("complete")}>
            Complete sprint
          </Button>
        )}

        {(canManage || canContribute) && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${sprint.name}`}
              className="grid size-7 place-items-center rounded-sm text-text-subtle transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
            >
              <MoreIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem icon={<PencilIcon />} onSelect={() => onAction("edit")}>
                {canManage ? "Edit sprint" : "Sprint details"}
              </DropdownMenuItem>
              {canContribute && (
                <DropdownMenuItem icon={<PlusIcon />} onSelect={() => onAction("add-task")}>
                  Add task to this sprint
                </DropdownMenuItem>
              )}
              {canManage && sprint.state === "PLANNING" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="danger" icon={<TrashIcon />} onSelect={() => onAction("delete")}>
                    Delete sprint
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {sprint.goal && <p className="w-full px-1 text-xs text-text-muted">{sprint.goal}</p>}
    </>
  );
}
