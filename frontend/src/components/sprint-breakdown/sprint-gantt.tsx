import { STATUS_DOT } from "@/components/tasks/task-tone";
import { cn } from "@/lib/cn";
import { formatDeadline } from "@/lib/format-date";
import type { GanttRow } from "@/lib/sprint-breakdown";
import { addDays, daysInclusive } from "@/lib/sprint-dates";

/*
 * Every task as a bar across the sprint's window — the timeline view of the
 * same work the board shows as columns.
 *
 * THE BAR IS A WINDOW, NOT A SCHEDULE, and the caption under the chart says so
 * in words. A task carries no planned start date, so the bar runs from the
 * later of the sprint's start and the task's creation to whichever comes first
 * of completion, its due date, and the sprint's end (`ganttRows`). Drawing a
 * made-up start to get a prettier staircase would be drawing data that does
 * not exist.
 *
 * A task with NO due date is drawn open — a faded edge and a dashed end rather
 * than a hard stop at the sprint's end, because "runs to the end" and "has no
 * date at all" are different facts and a full-width bar would state the first
 * when the second is true.
 *
 * Positions are percentages of the window, so they are the one `style` here —
 * the same sanctioned exception `projects/timeline-row.tsx` takes.
 */
const TICKS = 4;

export function SprintGantt({
  rows,
  startDate,
  endDate,
  todayAt,
}: {
  rows: GanttRow[];
  startDate: string;
  endDate: string;
  /** Where today sits in the window, 0–100. */
  todayAt: number;
}) {
  const window = daysInclusive(startDate.slice(0, 10), endDate.slice(0, 10));
  const ticks = Array.from({ length: TICKS }, (_, index) => {
    const offset = Math.round((index / (TICKS - 1)) * (window - 1));
    return { at: (offset / window) * 100, date: addDays(startDate.slice(0, 10), offset) };
  });

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-stretch gap-3">
        {/* The names are real text in their own column, never labels floating
            over the bars — a title that does not fit its bar would otherwise
            be clipped, and a clipped title is worse than no chart. */}
        <ul className="w-40 shrink-0 sm:w-56">
          {rows.map(({ task }) => (
            <li key={task.id} className="flex h-9 items-center gap-2 border-b border-border last:border-b-0">
              <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[task.status.color])} />
              <span className="min-w-0 truncate text-xs text-text" title={`${task.key} · ${task.title}`}>
                {task.title}
              </span>
            </li>
          ))}
        </ul>

        <div className="relative min-w-0 flex-1">
          {/* Hairline, solid, one step off the surface — recessive by design.
              A dashed grid reads as noise and competes with the bars. */}
          {ticks.map((tick) => (
            <span key={tick.date} aria-hidden="true" className="absolute inset-y-0 w-px bg-border" style={{ left: `${tick.at}%` }} />
          ))}

          {/* Today is the one line allowed to be loud — it is what turns a
              picture of the plan into a picture of where the plan stands. */}
          {todayAt >= 0 && (
            <span aria-hidden="true" className="absolute inset-y-0 z-10 w-0.5 bg-brand-500" style={{ left: `${todayAt}%` }} />
          )}

          <ul className="relative">
            {rows.map(({ task, leftPercent, widthPercent, openEnded }) => (
              <li key={task.id} className="flex h-9 items-center border-b border-border last:border-b-0">
                <span
                  title={`${task.key}: ${task.status.name}${task.dueDate ? ` · due ${formatDeadline(task.dueDate)}` : " · no due date"}`}
                  className={cn(
                    "h-2.5 rounded-xs",
                    STATUS_DOT[task.status.color],
                    /* The open end fades instead of stopping, so "no due date"
                       cannot be misread as "ends here". */
                    openEnded && "rounded-r-none [mask-image:linear-gradient(to_right,black_55%,transparent)]",
                  )}
                  style={{ marginLeft: `${leftPercent}%`, width: `${Math.max(widthPercent, 2)}%` }}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-2 flex gap-3">
        <div className="w-40 shrink-0 sm:w-56" />
        <div className="relative h-4 min-w-0 flex-1">
          {ticks.map((tick) => (
            <span
              key={tick.date}
              /* Centred on its gridline, except at the two ends, where a
                 centred label would hang off the chart. */
              className="absolute -translate-x-1/2 text-2xs whitespace-nowrap text-text-subtle tabular-nums first:translate-x-0 last:-translate-x-full"
              style={{ left: `${tick.at}%` }}
            >
              {formatDeadline(tick.date)}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-4 border-t border-border pt-3 text-xs text-text-muted">
        Each bar runs from when the task was created to its due date — or to the end of the sprint when it has none, drawn with a faded
        end. Tasks have no planned start date, so this is the window a task sits in, not a schedule.{" "}
        <span className="text-text-subtle">Bar colour is the task&rsquo;s status; the green line is today.</span>
      </p>
    </div>
  );
}
