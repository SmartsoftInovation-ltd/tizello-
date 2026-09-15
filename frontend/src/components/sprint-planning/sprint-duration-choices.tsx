"use client";

import { cn } from "@/lib/cn";
import { endDateFor, SPRINT_WEEKS } from "@/lib/sprint-plan";

/**
 * "1 week · 2 weeks · 3 weeks · 4 weeks" — pick a length and the end date
 * follows from the start date.
 *
 * That is how teams talk about a sprint, so it is the fast path; the end date
 * field beside it stays editable for the holiday-shortened one, and editing it
 * by hand simply leaves no button selected. Shared by the sprint drawer and the
 * start dialog so the two cannot disagree about what "2 weeks" ends on.
 */
export function SprintDurationChoices({
  startDate,
  endDate,
  fallbackStart,
  onChange,
}: {
  startDate: string;
  endDate: string;
  /** Used when no start date is set yet — today. */
  fallbackStart: string;
  onChange: (dates: { startDate: string; endDate: string }) => void;
}) {
  const start = startDate || fallbackStart;
  const selected = SPRINT_WEEKS.find((weeks) => endDateFor(start, weeks) === endDate);

  return (
    <div role="radiogroup" aria-label="Sprint length" className="flex flex-wrap gap-1.5">
      {SPRINT_WEEKS.map((weeks) => (
        <button
          key={weeks}
          type="button"
          role="radio"
          aria-checked={selected === weeks}
          onClick={() => onChange({ startDate: start, endDate: endDateFor(start, weeks) })}
          className={cn(
            "rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors duration-100 ease-standard",
            selected === weeks
              ? "border-brand-500 bg-brand-500 text-on-brand"
              : "border-border text-text-muted hover:bg-surface-hover hover:text-text",
          )}
        >
          {weeks === 1 ? "1 week" : `${weeks} weeks`}
        </button>
      ))}
    </div>
  );
}
