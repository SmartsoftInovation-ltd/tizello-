import { daysInclusive } from "@/lib/sprint-dates";
import type { StatusColor, Task, TaskStatusGroup, TaskStatusOption } from "@/types/task";

/*
 * The numbers behind the sprint breakdown's three charts. Pure arithmetic —
 * the SVG and the bars are markup, and there is no chart library, exactly as
 * `status-breakdown.ts` says for the projects donut.
 *
 * Everything here is a pure function of its arguments, `scope.today` included.
 * Nothing calls `new Date()`: `sprint-dates.ts` documents at length why a value
 * derived from an unpinned "now" is thrown away at hydration.
 */

const day = (iso: string) => iso.slice(0, 10);

/* Percentages are rounded independently — `status-breakdown.ts` explains the
   trade at length: a column that sums to 101 is less wrong than two identical
   counts showing two different percentages. Arcs and bars are drawn from the
   UNROUNDED fractions, so no chart is a rounded approximation of itself. */
const share = (part: number, whole: number) => (whole === 0 ? 0 : (part / whole) * 100);

/* ------------------------------------------------------------------ SHARE */

export type StatusShare = {
  id: string;
  name: string;
  color: StatusColor;
  count: number;
  points: number;
  percent: number;
  /** Where this arc starts, 0–100, walking the ring from twelve o'clock. */
  startPercent: number;
};

/**
 * One slice per status, in the project's own status order — EMPTY ONES
 * INCLUDED, the way `groupByStatus` keeps empty project groups. A status a
 * team defined and nobody used is a fact about the sprint; dropping it would
 * make the legend silently disagree with the board's columns.
 */
export function statusShares(tasks: Task[], statuses: TaskStatusOption[]): StatusShare[] {
  let cursor = 0;

  return statuses.map((status) => {
    const mine = tasks.filter((task) => task.statusId === status.id);
    const startPercent = cursor;
    cursor += share(mine.length, tasks.length);

    return {
      id: status.id,
      name: status.name,
      color: status.color,
      count: mine.length,
      points: mine.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0),
      percent: Math.round(share(mine.length, tasks.length)),
      startPercent,
    };
  });
}

/* ------------------------------------------------------------------- LOAD */

export type AssigneeLoad = {
  id: string;
  name: string;
  /** Points per group — the three segments of this person's bar. */
  points: Record<TaskStatusGroup, number>;
  total: number;
  taskCount: number;
};

const UNASSIGNED = "unassigned";

/**
 * Points per person, split by status group — who is carrying what, and how
 * much of it has landed.
 *
 * A TASK WITH TWO ASSIGNEES COUNTS ITS FULL POINTS FOR BOTH, so the bars
 * deliberately sum to more than the sprint's total. Splitting 5 points into
 * 2.5 each would claim the pair agreed to halve the work, which is not
 * something the data knows; the caption says the rule out loud instead.
 *
 * Unassigned work is a row, not a silence — it is usually the thing a
 * stand-up needs to see.
 */
export function assigneeLoad(tasks: Task[]): AssigneeLoad[] {
  const rows = new Map<string, AssigneeLoad>();

  const row = (id: string, name: string) => {
    const found = rows.get(id);
    if (found) return found;
    const made: AssigneeLoad = { id, name, points: { TODO: 0, IN_PROGRESS: 0, COMPLETE: 0 }, total: 0, taskCount: 0 };
    rows.set(id, made);
    return made;
  };

  for (const task of tasks) {
    const points = task.storyPoints ?? 0;
    const people = task.assignees.length > 0 ? task.assignees.map((person) => ({ id: person.id, name: person.name ?? person.email })) : [{ id: UNASSIGNED, name: "Unassigned" }];

    for (const person of people) {
      const entry = row(person.id, person.name);
      entry.points[task.status.group] += points;
      entry.total += points;
      entry.taskCount += 1;
    }
  }

  /* Heaviest first — the bar chart's job is "who is loaded", so the answer
     belongs at the top. Unassigned sinks to the bottom whatever its size: it
     is a gap to fill, not a person to compare against. */
  return [...rows.values()].sort((a, b) => {
    if (a.id === UNASSIGNED) return 1;
    if (b.id === UNASSIGNED) return -1;
    return b.total - a.total || b.taskCount - a.taskCount;
  });
}

/* ------------------------------------------------------------------ GANTT */

export type GanttRow = {
  task: Task;
  leftPercent: number;
  widthPercent: number;
  /** No due date: the bar runs to the sprint's end and is drawn open. */
  openEnded: boolean;
};

/** Which day of the window `iso` falls on, clamped to it. 0 is the first day. */
function dayIndex(start: string, end: string, iso: string): number {
  const offset = daysInclusive(start, iso) - 1;
  return Math.min(Math.max(offset, 0), daysInclusive(start, end) - 1);
}

/**
 * Each task as a bar across the sprint window.
 *
 * THE BAR IS NOT A SCHEDULE, AND THE CAPTION SAYS SO. A task carries no
 * planned start: what it has is when it appeared (`createdAt`), when it is due
 * (`dueDate`) and when it landed (`completedAt`). So the bar runs from the
 * later of the sprint's start and the task's creation, to whichever comes
 * first of completion, the due date, and the sprint's end. Inventing a start
 * date to make a prettier chart would be inventing data.
 *
 * A task with no due date is open-ended rather than full-width-by-default —
 * the reader has to be able to tell "runs to the end of the sprint" from "has
 * no date at all".
 */
export function ganttRows(tasks: Task[], startDate: string, endDate: string): GanttRow[] {
  const start = day(startDate);
  const end = day(endDate);
  const window = daysInclusive(start, end);

  return tasks.map((task) => {
    const from = dayIndex(start, end, day(task.createdAt));
    const finish = task.completedAt ?? task.dueDate;
    const to = finish ? dayIndex(start, end, day(finish)) : window - 1;

    return {
      task,
      leftPercent: share(from, window),
      widthPercent: share(Math.max(to - from, 0) + 1, window),
      openEnded: !finish,
    };
  });
}

/** Where today sits in the window, 0–100. Outside it, clamped to an edge. */
export function todayPercent(startDate: string, endDate: string, today: string): number {
  const start = day(startDate);
  const end = day(endDate);
  return share(dayIndex(start, end, today), daysInclusive(start, end));
}

/* ------------------------------------------------------------------- STEP */

/**
 * How far a task has moved through the team's OWN workflow: the position of
 * its status in the project's ordered status list.
 *
 * This is the only honest per-task progress this data supports. A percentage
 * invented from the status group — to-do 0, in progress 50, done 100 — would
 * claim a task is half finished on the strength of somebody dragging a card,
 * which the record does not say. "Step 3 of 5" says exactly what is known:
 * which stage it has reached, out of how many the team defined.
 */
export function statusStep(statuses: TaskStatusOption[], statusId: string): { step: number; of: number } {
  const index = statuses.findIndex((status) => status.id === statusId);
  return { step: index < 0 ? 0 : index + 1, of: statuses.length };
}
