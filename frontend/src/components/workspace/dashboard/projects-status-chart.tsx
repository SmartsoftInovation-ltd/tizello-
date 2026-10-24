import { ChartTip } from "@/components/workspace/dashboard/chart-tip";
import { STATUS_LABEL } from "@/lib/project-groups";
import { PROJECT_STATUSES, type ProjectStatus } from "@/types/project";

/*
 * Projects across every workspace, by status — one bar per status.
 *
 * ONE COLOUR, NOT SIX. The project-status hues were run through the dataviz
 * palette validator as a six-slot categorical set and failed: planning-purple
 * and active-blue are under the normal-vision floor even for full colour
 * vision, and backlog-grey has no chroma. So the status is carried by its
 * printed name, magnitude by bar length, and every bar is `chart-bar` — the
 * single-series form, which needs no legend (the title names it).
 *
 * IT IS A REAL TABLE. Rows are statuses, the value column is the count: the
 * chart and its accessible table view are the same markup, so a screen reader
 * reads a table and a sighted reader sees bars. Bars are capped thin, rounded
 * at the data end and square at the baseline; the count sits at the tip in
 * text ink.
 */
export function ProjectsStatusChart({ counts }: { counts: Record<ProjectStatus, number> }) {
  const max = Math.max(1, ...PROJECT_STATUSES.map((status) => counts[status]));

  return (
    <section aria-labelledby="projects-status-title" className="p-5">
      <h2 id="projects-status-title" className="text-sm font-semibold text-text">
        Projects by status
      </h2>

      <table className="mt-5 w-full border-separate border-spacing-y-2.5 text-xs">
        <thead className="sr-only">
          <tr>
            <th scope="col">Status</th>
            <th scope="col">Projects</th>
          </tr>
        </thead>
        <tbody>
          {PROJECT_STATUSES.map((status) => (
            <tr key={status}>
              <th scope="row" className="w-24 pr-3 text-left font-medium whitespace-nowrap text-text-muted">
                {STATUS_LABEL[status]}
              </th>
              <td>
                <span className="flex items-center gap-2">
                  {/* The track takes the leftover width, so a full bar never
                      pushes its count out of the cell. */}
                  <span className="flex min-w-0 flex-1 items-center">
                    {counts[status] > 0 ? (
                      <span className="h-2.5" style={{ width: `${(counts[status] / max) * 100}%` }}>
                        <ChartTip
                          value={`${counts[status]} ${counts[status] === 1 ? "project" : "projects"}`}
                          label={STATUS_LABEL[status]}
                          className="h-full rounded-r-[4px] bg-chart-bar transition-opacity duration-150 ease-standard hover:opacity-80"
                        />
                      </span>
                    ) : (
                      <span aria-hidden="true" className="h-2.5 w-px bg-border-strong" />
                    )}
                  </span>
                  <span className="w-6 shrink-0 text-right text-text tabular-nums">{counts[status]}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
