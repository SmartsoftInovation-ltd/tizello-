import { STATUS_DOT, STATUS_STROKE } from "@/components/tasks/task-tone";
import { cn } from "@/lib/cn";
import type { StatusShare } from "@/lib/sprint-breakdown";

/*
 * Share of the sprint by status, as a ring — the same inline-SVG donut the
 * projects Status breakdown draws (`projects/status-donut.tsx`), pointed at
 * task statuses instead of project ones.
 *
 * `dasharray` and `dashoffset` are SVG PRESENTATION ATTRIBUTES, not inline
 * styles: the numbers are geometry, and the only reason they are not utilities
 * is that no utility could express them. Arcs use the UNROUNDED fraction, so
 * the ring is never a rounded approximation of itself.
 *
 * WHY A RING IS SAFE HERE AND ONLY HERE. Part-to-whole at a glance is the one
 * job a donut does better than a bar, and it holds to about six slices. Past
 * that, adjacent arcs are too close in angle to tell apart — so every number
 * is also real text in the legend beside it and in the table below, and the
 * panel says "compare lengths, not angles" by putting the count first.
 *
 * The hues are the team's own status colours, which are `label-*` primitives:
 * decorative, deliberately desaturated, and NOT safe as the sole carrier of
 * identity (brown and red are one colour to a red-blind reader). That is the
 * reason for the legend rather than a nicety — colour here is recognition for
 * people who already know their board, never the channel the value is read
 * from.
 */
const RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function StatusShareDonut({ shares, total, label }: { shares: StatusShare[]; total: number; label: string }) {
  return (
    <div className="relative size-44 shrink-0">
      <svg viewBox="0 0 120 120" role="img" aria-label={label} className="size-44">
        <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="14" className="stroke-surface-hover" />

        {/* -90deg so the first arc starts at twelve o'clock, not three. */}
        <g transform="rotate(-90 60 60)">
          {shares
            .filter((slice) => slice.count > 0)
            .map((slice) => {
              const length = (slice.count / total) * CIRCUMFERENCE;
              return (
                <circle
                  key={slice.id}
                  cx="60"
                  cy="60"
                  r={RADIUS}
                  fill="none"
                  strokeWidth="14"
                  strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                  strokeDashoffset={-(slice.startPercent / 100) * CIRCUMFERENCE}
                  className={STATUS_STROKE[slice.color]}
                />
              );
            })}
        </g>
      </svg>

      {/* Decoration: the same total is a real heading in the panel, so it is
          hidden here rather than read out twice. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-text">{total}</span>
        <span className="text-2xs text-text-subtle">{total === 1 ? "task" : "tasks"}</span>
      </div>
    </div>
  );
}

/**
 * Every slice as real text — the channel the numbers are actually read from.
 * Empty statuses stay: a status the team defined and nobody used is a fact
 * about the sprint, and dropping it would make this list disagree with the
 * board's columns.
 */
export function StatusShareLegend({ shares }: { shares: StatusShare[] }) {
  return (
    <ul className="w-full min-w-0 max-w-md">
      {shares.map((slice) => (
        <li key={slice.id} className="flex items-center gap-2 border-b border-border py-2 text-sm last:border-b-0">
          <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[slice.color])} />
          <span className="min-w-0 flex-1 truncate text-text">{slice.name}</span>
          <span className="w-10 shrink-0 text-right text-text-subtle tabular-nums">{slice.points} pts</span>
          <span className="w-8 shrink-0 text-right font-semibold text-text tabular-nums">{slice.count}</span>
          <span className="w-10 shrink-0 text-right text-text-subtle tabular-nums">{slice.percent}%</span>
        </li>
      ))}
    </ul>
  );
}
