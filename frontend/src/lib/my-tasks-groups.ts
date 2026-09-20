import { addDays, daysRemaining } from "@/lib/sprint-dates";
import type { AssignedState, AssignedTask } from "@/types/task";

/*
 * "My tasks", bucketed by when it is due. Pure arithmetic — a function of the
 * task list and `today`, which is passed in rather than read from a clock, for
 * the reason `sprint-dates.ts` documents at length.
 *
 * BY DEADLINE, NOT BY PROJECT. A to-do list spanning six projects sorted into
 * six project sections makes the reader do the merge themselves — they have to
 * scan every section to find what is due today. The project is a column on the
 * row instead, where it answers "where is this?" without organising around it.
 *
 * The server already returns the list in this order (due date, then priority),
 * so bucketing only has to cut it, never sort it.
 */

export const DUE_BUCKETS = ["overdue", "today", "soon", "later", "someday"] as const;
export type DueBucket = (typeof DUE_BUCKETS)[number];

export const DUE_BUCKET_LABEL: Record<DueBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  soon: "Next 7 days",
  later: "Later",
  someday: "No due date",
};

/**
 * Which bucket a task falls in.
 *
 * A COMPLETED TASK IS NEVER OVERDUE. Finishing late is a fact about the past;
 * flagging it red on a list of things to do would be asking someone to act on
 * work that is already done. Completed work sorts by its date like anything
 * else — this only stops it wearing the alarm.
 */
export function dueBucket(task: AssignedTask, today: string): DueBucket {
  if (!task.dueDate) return "someday";

  const left = daysRemaining(today, task.dueDate.slice(0, 10));
  const done = task.status.group === "COMPLETE";

  if (left < 1 && !done) return "overdue";
  if (left === 1) return "today";
  /* `daysRemaining` counts today as 1, so "within the next 7 days" is 2..8 —
     tomorrow through a week out, today already having its own bucket. */
  if (left <= 8) return "soon";
  return "later";
}

export type DueGroup = { bucket: DueBucket; tasks: AssignedTask[] };

/**
 * The list cut into buckets, in `DUE_BUCKETS` order, EMPTY ONES DROPPED.
 *
 * Unlike the sprint board's status columns — which keep empty statuses because
 * an unused column is a fact about the workflow — an empty "Overdue" heading
 * is just a reminder of a category you are not in. The reader wants the
 * shortest list that still says everything.
 */
export function groupByDue(tasks: AssignedTask[], today: string): DueGroup[] {
  return DUE_BUCKETS.map((bucket) => ({ bucket, tasks: tasks.filter((task) => dueBucket(task, today) === bucket) })).filter(
    (group) => group.tasks.length > 0,
  );
}

/** How many are overdue — the one number worth saying before the list. */
export function overdueCount(tasks: AssignedTask[], today: string): number {
  return tasks.filter((task) => dueBucket(task, today) === "overdue").length;
}

/** `true` when the task is due on the day after `today` — the row says "Tomorrow" rather than a date. */
export function isTomorrow(dueDate: string, today: string): boolean {
  return dueDate.slice(0, 10) === addDays(today, 1);
}

/* ---------------------------------------------------------------- PROGRESS */

export type MyTasksProgress = {
  TODO: number;
  IN_PROGRESS: number;
  COMPLETE: number;
  total: number;
  /** Whole percent complete. `0` when there is nothing assigned — not `NaN`. */
  percent: number;
};

/**
 * How much of everything assigned to you is finished, counted in TASKS rather
 * than story points.
 *
 * Points measure a sprint's capacity; a personal to-do list is answered "how
 * many things are left", and half the tasks anyone is assigned carry no
 * estimate at all — a points bar would silently leave those out of both the
 * numerator and the denominator and call the result progress.
 *
 * Counted over the WHOLE assigned list, never the filtered view. A bar that
 * read 100% because you were looking at the Done tab would be measuring the
 * filter instead of the work.
 */
export function assignedProgress(tasks: AssignedTask[]): MyTasksProgress {
  const counts = { TODO: 0, IN_PROGRESS: 0, COMPLETE: 0 };
  for (const task of tasks) counts[task.status.group] += 1;

  return {
    ...counts,
    total: tasks.length,
    percent: tasks.length === 0 ? 0 : Math.round((counts.COMPLETE / tasks.length) * 100),
  };
}

/** The list the chosen tab shows. The progress bar deliberately ignores this. */
export function filterByState(tasks: AssignedTask[], state: AssignedState): AssignedTask[] {
  if (state === "all") return tasks;
  if (state === "done") return tasks.filter((task) => task.status.group === "COMPLETE");
  return tasks.filter((task) => task.status.group !== "COMPLETE");
}
