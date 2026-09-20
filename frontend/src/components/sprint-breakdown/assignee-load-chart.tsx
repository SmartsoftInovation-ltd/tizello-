import type { AssigneeLoad } from "@/lib/sprint-breakdown";
import { cn } from "@/lib/cn";
import { TASK_STATUS_GROUP_LABEL, type TaskStatusGroup } from "@/types/task";

/*
 * Points per person, as one horizontal stacked bar each — who is carrying what,
 * and how much of it has landed.
 *
 * A BAR, NOT A SECOND RING. The donut answers "what is the sprint made of";
 * this answers "compare these people", and comparing lengths against a shared
 * baseline is the one thing a bar does better than anything else. The two
 * charts deliberately measure different things — a second view of the same
 * split would be decoration.
 *
 * SEGMENTS ARE THE THREE GROUPS, NOT THE NINE STATUSES. Done / In progress /
 * To do is the split that means the same thing in every project, and three
 * segments stay distinguishable at 10px tall where nine would not. The colours
 * are `sprint-progress.tsx`'s exactly, so a reader who has learned the strip on
 * the board reads this without relearning it.
 *
 * WIDTHS ARE SHARES OF THE HEAVIEST ROW, not of each row's own total. A bar
 * scaled to itself makes every person look equally loaded, which is the one
 * question this chart exists to answer.
 *
 * The 2px surface gap between segments is what separates them — never a stroke
 * around each, which would add ink that is not data.
 */
const SEGMENTS = [
  { key: "COMPLETE", fill: "bg-success" },
  { key: "IN_PROGRESS", fill: "bg-label-blue/70" },
  { key: "TODO", fill: "bg-border-strong" },
] as const satisfies readonly { key: TaskStatusGroup; fill: string }[];

export function AssigneeLoadChart({ rows }: { rows: AssigneeLoad[] }) {
  const heaviest = Math.max(...rows.map((row) => row.total), 1);

  return (
    <div>
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.id}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-medium text-text">{row.name}</p>
              {/* Direct label at the tip — the value never depends on the
                  tooltip or on reading a length against an axis. */}
              <p className="shrink-0 text-xs text-text-muted tabular-nums">
                <span className="font-semibold text-text">{row.total}</span> pts ·{" "}
                {row.taskCount} {row.taskCount === 1 ? "task" : "tasks"}
              </p>
            </div>

            {/* The track is the full width; the bar inside it is this row's
                share of the heaviest row, so every bar is on one scale. */}
            <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-xs bg-surface-hover">
              <div className="flex h-full gap-0.5" style={{ width: `${(row.total / heaviest) * 100}%` }}>
                {SEGMENTS.map(({ key, fill }) =>
                  row.points[key] > 0 ? (
                    <span
                      key={key}
                      title={`${TASK_STATUS_GROUP_LABEL[key]}: ${row.points[key]} pts`}
                      className={cn("first:rounded-l-xs last:rounded-r-xs", fill)}
                      style={{ width: `${(row.points[key] / row.total) * 100}%` }}
                    />
                  ) : null,
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <ChartLegend />
    </div>
  );
}

/**
 * Always present, because there are three series: identity is never colour
 * alone. The swatch is a rect to mirror the mark it names — a bar, not a line.
 */
export function ChartLegend() {
  return (
    <ul className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-text-muted">
      {SEGMENTS.map(({ key, fill }) => (
        <li key={key} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("h-2 w-3 rounded-[1px]", fill)} />
          {TASK_STATUS_GROUP_LABEL[key]}
        </li>
      ))}
    </ul>
  );
}
