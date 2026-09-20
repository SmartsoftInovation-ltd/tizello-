import { SprintCountdown } from "@/components/current-sprint/sprint-countdown";
import { cn } from "@/lib/cn";
import { formatDeadline } from "@/lib/format-date";
import { daysInclusive, daysRemaining } from "@/lib/sprint-dates";
import type { PointsByGroup } from "@/lib/sprint-plan";

/**
 * The sprint's progress strip, under its header: WORK (a segmented bar of
 * Done / In progress / To do points), TIME (how far through the time-box today
 * is) and the live countdown.
 *
 * ONE SHAPE, SO THEY LINE UP. Work and Time are built identically — a label
 * row, a 6px bar, a caption row — and the strip centres its three cells
 * vertically, so the two bars sit on one line and the countdown panel sits
 * centred beside them rather than hanging off the bottom.
 *
 * TIME-LEFT IS A NUMBER IN EXACTLY ONE PLACE — the countdown. The caption
 * under the bar names the deadline instead of counting toward it, because the
 * two counted in different units and so disagreed on screen: "2 days left" is
 * calendar days INCLUDING today, while the countdown runs to 23:59:59 on the
 * end date, so the afternoon before the last day read "2 days left" beside a
 * tile showing 1. Both were right; showing both was the bug.
 *
 * Reading work and time together is the point: 30% done at 80% of the time is
 * the sentence a stand-up needs. Segment widths are genuinely dynamic values,
 * so they are the one `style` here. In progress is `label-blue` at 70% — a
 * soft periwinkle rather than `info`'s deep blue. Over capacity, the total
 * turns `danger`.
 */
const SEGMENTS = [
  { key: "COMPLETE", label: "Done", fill: "bg-success" },
  { key: "IN_PROGRESS", label: "In progress", fill: "bg-label-blue/70" },
  { key: "TODO", label: "To do", fill: "bg-border-strong" },
] as const;

const day = (iso: string) => iso.slice(0, 10);

function Cell({ label, value, children, caption }: { label: string; value: React.ReactNode; children: React.ReactNode; caption: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-2xs font-semibold tracking-widest text-text-subtle uppercase">{label}</p>
        <p className="truncate text-xs text-text-muted tabular-nums">{value}</p>
      </div>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-surface-hover">{children}</div>
      <div className="mt-2 flex min-h-4 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">{caption}</div>
    </div>
  );
}

export function SprintProgress({
  points,
  capacity,
  startDate,
  endDate,
  today,
}: {
  points: PointsByGroup;
  capacity: number | null;
  startDate: string | null;
  endDate: string | null;
  today: string;
}) {
  const done = points.total > 0 ? Math.round((points.COMPLETE / points.total) * 100) : 0;
  const over = capacity !== null && points.total > capacity;

  const length = startDate && endDate ? daysInclusive(day(startDate), day(endDate)) : null;
  const left = endDate ? daysRemaining(today, day(endDate)) : null;
  const late = left !== null && left < 0;
  const elapsed = length !== null && left !== null ? Math.min(length, Math.max(1, length - Math.max(left, 0) + 1)) : null;
  const timePercent = late ? 100 : length && elapsed !== null ? Math.round((elapsed / length) * 100) : 0;

  return (
    <div className="grid items-center gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
      <Cell
        label="Work"
        value={
          <>
            <span className="font-semibold text-text">{done}%</span> done ·{" "}
            <span className={cn(over && "font-semibold text-danger")}>
              {points.total}
              {capacity !== null ? ` / ${capacity}` : ""} pts
            </span>
          </>
        }
        caption={
          <>
            {SEGMENTS.map(({ key, label, fill }) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className={cn("size-2 rounded-full", fill)} />
                {label}
                <span className="font-semibold text-text tabular-nums">{points[key]}</span>
              </span>
            ))}
            {points.unestimated > 0 && <span className="text-text-subtle">{points.unestimated} unestimated</span>}
          </>
        }
      >
        {SEGMENTS.map(({ key, fill }) =>
          points[key] > 0 ? (
            <span key={key} className={cn("transition-[width] duration-500 ease-standard", fill)} style={{ width: `${(points[key] / points.total) * 100}%` }} />
          ) : null,
        )}
      </Cell>

      <Cell
        label="Time"
        value={
          length === null || elapsed === null ? (
            "No dates set"
          ) : late ? (
            <span className="font-semibold text-danger">{-left} days overdue</span>
          ) : (
            <>
              Day <span className="font-semibold text-text">{elapsed}</span> of {length}
            </>
          )
        }
        caption={
          endDate === null
            ? "Set dates to track time"
            : late
              ? `Ended ${formatDeadline(endDate)}`
              : left === 1
                ? `Last day — ends ${formatDeadline(endDate)}`
                : `Ends ${formatDeadline(endDate)}`
        }
      >
        <span className={cn("rounded-full transition-[width] duration-500 ease-standard", late ? "bg-danger" : "bg-brand-500")} style={{ width: `${timePercent}%` }} />
      </Cell>

      {endDate && (
        <div className="md:col-span-2 xl:col-span-1 xl:justify-self-end">
          <SprintCountdown endDate={endDate} />
        </div>
      )}
    </div>
  );
}
