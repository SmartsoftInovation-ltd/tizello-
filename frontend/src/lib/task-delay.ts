/*
 * How late a task is, as a pure function.
 *
 * DERIVED, NEVER STORED. Delay is the distance between two dates the task
 * already has — the due date and the day it was finished (or today, while it
 * is not) — so a column for it would be a third value that can disagree with
 * the other two. Notion models it as a formula for the same reason.
 *
 * Whole UTC days, compared as `YYYY-MM-DD` strings turned into day numbers:
 * `today` comes from `lib/today.ts`, which pins the day boundary to UTC, and
 * mixing a local-time `Date` in here would make a task due "today" read as a
 * day late for anyone east of Greenwich.
 */

const DAY = 24 * 60 * 60 * 1000;

function dayNumber(iso: string): number | null {
  const stamp = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(stamp) ? null : Math.round(stamp / DAY);
}

/**
 * Days past due: positive when late, `0` when finished on the day, negative
 * when there is still time. `null` with no due date — a task nobody scheduled
 * cannot be late.
 */
export function taskDelayDays({
  dueDate,
  completedAt,
  today,
}: {
  dueDate: string;
  completedAt: string;
  today: string;
}): number | null {
  if (!dueDate) return null;

  const due = dayNumber(dueDate);
  const end = dayNumber(completedAt || today);
  if (due === null || end === null) return null;

  return end - due;
}

/** The sentence the Delay row shows. */
export function describeDelay(days: number | null, done: boolean): string {
  if (days === null) return "";
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} late`;
  if (done) return "On time";
  if (days === 0) return "Due today";
  return `${-days} day${days === -1 ? "" : "s"} left`;
}
