import { ChartTip } from "@/components/workspace/dashboard/chart-tip";
import { WorkspaceAvatar } from "@/components/workspace/workspace-avatar";
import type { WorkspaceOverviewRow } from "@/lib/workspace-overview";
import type { TaskStatusGroup } from "@/types/task";

/*
 * Tasks per workspace, as stacked horizontal bars: To do → In progress → Done.
 *
 * FORM. Part-to-whole per workspace AND magnitude across them, so the bars
 * share one scale (the busiest workspace is full width) instead of each being
 * stretched to 100% — a small workspace that is all done should look small.
 *
 * COLOUR. The three groups are ORDERED, so they are an ordinal ramp of one
 * hue (`chart-step-1..3`, validated light and dark), not three unrelated
 * categories. Segments are separated by a 2px surface gap, never a stroke;
 * the bar's data end is rounded, its baseline square. A legend is always
 * drawn (three series), and every count is in the table view below — the
 * tooltip enhances, it never gates. The figure at the end of each row is the
 * open count, in text ink, never the series colour.
 */
const SEGMENTS: readonly { key: TaskStatusGroup; label: string; fill: string }[] = [
  { key: "TODO", label: "To do", fill: "bg-chart-step-1" },
  { key: "IN_PROGRESS", label: "In progress", fill: "bg-chart-step-2" },
  { key: "COMPLETE", label: "Done", fill: "bg-chart-step-3" },
];

const total = (row: WorkspaceOverviewRow) => row.tasks.TODO + row.tasks.IN_PROGRESS + row.tasks.COMPLETE;

export function TaskProgressChart({ rows }: { rows: WorkspaceOverviewRow[] }) {
  const sorted = [...rows].sort((a, b) => total(b) - total(a));
  const max = Math.max(1, ...sorted.map(total));

  return (
    <section aria-labelledby="task-progress-title" className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="task-progress-title" className="text-sm font-semibold text-text">
          Tasks by workspace
        </h2>
        <ul className="flex items-center gap-3 text-2xs text-text-muted" aria-label="Legend">
          {SEGMENTS.map((segment) => (
            <li key={segment.key} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`size-2.5 rounded-xs ${segment.fill}`} />
              {segment.label}
            </li>
          ))}
        </ul>
      </div>

      <ul className="mt-5 space-y-3.5">
        {sorted.map((row) => (
          <li key={row.id} className="grid grid-cols-[minmax(0,9rem)_1fr_4.5rem] items-center gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <WorkspaceAvatar name={row.name} icon={row.icon} color={row.color} size="sm" />
              <span className="truncate text-xs font-medium text-text">{row.name}</span>
            </span>

            <span className="flex h-3 min-w-0" style={{ width: `${(total(row) / max) * 100}%` }}>
              {/* No `overflow-hidden` — it would clip the tooltips; the data end
                  is rounded on the last segment instead. */}
              <span className="flex w-full gap-0.5 [&>span:last-child>span]:rounded-r-[4px]">
                {SEGMENTS.filter((segment) => row.tasks[segment.key] > 0).map((segment) => (
                  /* Width is the count itself: `flex-grow` with a zero basis
                     splits the bar exactly in proportion, gap included. */
                  <span key={segment.key} className="h-full min-w-0.5" style={{ flex: `${row.tasks[segment.key]} 1 0` }}>
                    <ChartTip
                      value={row.tasks[segment.key].toLocaleString("en-US")}
                      label={`${segment.label} in ${row.name}`}
                      className={`h-full transition-opacity duration-150 ease-standard hover:opacity-80 ${segment.fill}`}
                    />
                  </span>
                ))}
              </span>
            </span>

            <span className="text-right text-xs text-text-muted tabular-nums">
              {(row.tasks.TODO + row.tasks.IN_PROGRESS).toLocaleString("en-US")} open
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
