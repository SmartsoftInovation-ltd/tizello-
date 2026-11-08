import { sortStatuses } from "@/lib/task-status-order";
import type { StatusColor, Task, TaskStatusGroup, TaskStatusOption } from "@/types/task";

/*
 * The arithmetic behind the sprint board's progress strip — pure, so it is
 * tested without a renderer.
 *
 * WORK BY STATUS. The bar is one segment per STATUS in that status's own
 * colour (Cancel red, QA purple, …), in board order, so a card dragged from QA
 * to Done moves its points from one coloured segment to the other at once.
 * "% done" still reads the Complete GROUP, never a name — see
 * `.claude/rules/workflow.md`.
 *
 * TIME LEFT. The time bar starts FULL and drains to empty as the sprint runs,
 * changing tone as it goes: green with more than half left, yellow at half or
 * less, orange at a quarter or less, red on the last day and once overdue.
 */

export type StatusSlice = {
  id: string;
  name: string;
  color: StatusColor;
  group: TaskStatusGroup;
  points: number;
  count: number;
};

/** Points and cards per status, in board order, for the statuses that hold any sprint card. */
export function workByStatus(tasks: Task[], statuses: TaskStatusOption[]): StatusSlice[] {
  return sortStatuses(statuses)
    .map((status) => {
      const mine = tasks.filter((task) => task.statusId === status.id);
      return {
        id: status.id,
        name: status.name,
        color: status.color,
        group: status.group,
        points: mine.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0),
        count: mine.length,
      };
    })
    .filter((slice) => slice.count > 0);
}

/**
 * Each slice's share of the bar, in percent. Weighted by points; a sprint
 * with no estimates at all is weighted by card count instead, so the bar is
 * never blank while cards are on the board.
 */
export function sliceWidths(slices: StatusSlice[]): number[] {
  const byPoints = slices.reduce((sum, slice) => sum + slice.points, 0);
  const weight = (slice: StatusSlice) => (byPoints > 0 ? slice.points : slice.count);
  const total = byPoints > 0 ? byPoints : slices.reduce((sum, slice) => sum + slice.count, 0);
  return slices.map((slice) => (total > 0 ? (weight(slice) / total) * 100 : 0));
}

export type TimeTone = "plenty" | "half" | "low" | "critical";

/**
 * How much of the time-box is LEFT, as a bar width, and its tone. `length` and
 * `left` are whole days, both counting today (`daysInclusive`, `daysRemaining`).
 * Overdue fills the bar red rather than emptying it — an empty bar reads as
 * "nothing to worry about", which is the opposite of the truth.
 */
export function timeLeft(length: number, left: number): { percent: number; tone: TimeTone } {
  if (left <= 1) return { percent: left < 1 ? 100 : Math.round((1 / length) * 100), tone: "critical" };
  const percent = Math.round((Math.min(left, length) / length) * 100);
  return { percent, tone: percent > 50 ? "plenty" : percent > 25 ? "half" : "low" };
}
