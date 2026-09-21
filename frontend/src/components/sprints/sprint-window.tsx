import { formatDate } from "@/lib/format-date";
import { daysInclusive, daysRemaining } from "@/lib/sprint-dates";
import { plural } from "@/lib/plural";
import type { SprintRecord } from "@/types/sprint";

/*
 * `31 Aug 2026 → 11 Sep 2026 · 12 days`, through `formatDate` so the locale and
 * the time zone are pinned and the server and the browser cannot render
 * different text.
 *
 * `today` is a prop, never a live clock — see the note at the top of
 * `sprint-dates.ts`. It is only read for a running sprint, which is the one
 * case where "how much of the box is left" is worth saying.
 */
function remaining(today: string, endDate: string) {
  const left = daysRemaining(today, endDate);
  if (left > 0) return `${plural(left, "day", "days")} left`;
  return `${plural(Math.abs(left) + 1, "day", "days")} over`;
}

export function SprintWindow({
  sprint,
  today,
}: {
  /* Narrowed to the three fields the line reads. A caller holding an API
     `ProjectSprint` must check both dates first: they are nullable there, and
     this component is only honest about a sprint that HAS a time-box. */
  sprint: Pick<SprintRecord, "startDate" | "endDate" | "state">;
  /** The app's pinned today, threaded down from the page. */
  today: string;
}) {
  const overdue = sprint.state === "ACTIVE" && daysRemaining(today, sprint.endDate) <= 0;

  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-text-muted">
      <span className="whitespace-nowrap">
        {formatDate(sprint.startDate)}
        <span aria-hidden="true"> &rarr; </span>
        <span className="sr-only">to </span>
        {formatDate(sprint.endDate)}
      </span>

      <span aria-hidden="true" className="text-text-subtle">
        &middot;
      </span>
      <span className="whitespace-nowrap text-text-subtle">
        {plural(daysInclusive(sprint.startDate, sprint.endDate), "day", "days")}
      </span>

      {sprint.state === "ACTIVE" && (
        <>
          <span aria-hidden="true" className="text-text-subtle">
            &middot;
          </span>
          {/* Late is a fact worth reading as one. `danger` on `surface` is the
              only place the strong token is used on this card. */}
          <span
            className={
              overdue
                ? "font-semibold whitespace-nowrap text-danger"
                : "font-semibold whitespace-nowrap text-text"
            }
          >
            {remaining(today, sprint.endDate)}
          </span>
        </>
      )}
    </p>
  );
}
