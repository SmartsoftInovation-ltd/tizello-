import { STATUS_DOT } from "@/components/projects/project-tone";
import { ChartTip } from "@/components/workspace/dashboard/chart-tip";
import { cn } from "@/lib/cn";
import { STATUS_LABEL } from "@/lib/project-groups";
import { PROJECT_STATUSES, type ProjectStatus } from "@/types/project";

/*
 * Projects by status: one stacked bar for the whole mix, then a row per status
 * with its own colour, a bar scaled to the largest status, the count and its
 * share. The colours are the project screens' status dots (`project-tone.ts`),
 * so "Active" is the same blue here as on the board.
 *
 * A row per status rather than only the stacked bar, because a stacked bar
 * hides the small statuses — On hold at 2% is a sliver nobody can hover.
 * Every value is also text; colour is recognition only.
 */
export function ProjectsStatusChart({ counts }: { counts: Record<ProjectStatus, number> }) {
  const total = PROJECT_STATUSES.reduce((sum, status) => sum + counts[status], 0);
  const max = Math.max(1, ...PROJECT_STATUSES.map((status) => counts[status]));
  const share = (status: ProjectStatus) => (total > 0 ? Math.round((counts[status] / total) * 100) : 0);

  return (
    <section aria-labelledby="projects-status-title" className="p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="projects-status-title" className="text-sm font-semibold text-text">
          Projects by status
        </h2>
        <span className="text-xs text-text-subtle tabular-nums">{total} total</span>
      </div>

      <div aria-hidden="true" className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-surface-hover">
        {PROJECT_STATUSES.map((status) =>
          counts[status] > 0 ? (
            <span key={status} className={STATUS_DOT[status]} style={{ width: `${(counts[status] / total) * 100}%` }} />
          ) : null,
        )}
      </div>

      <ul className="mt-4 space-y-2.5">
        {PROJECT_STATUSES.map((status) => (
          <li key={status} className="flex items-center gap-3 text-xs">
            <span className="flex w-24 shrink-0 items-center gap-2 font-medium text-text-muted">
              <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[status])} />
              <span className="truncate">{STATUS_LABEL[status]}</span>
            </span>
            <span className="flex min-w-0 flex-1 items-center">
              {counts[status] > 0 ? (
                <span className="h-2" style={{ width: `${(counts[status] / max) * 100}%` }}>
                  <ChartTip
                    value={`${counts[status]} ${counts[status] === 1 ? "project" : "projects"} · ${share(status)}%`}
                    label={STATUS_LABEL[status]}
                    className={cn("h-full rounded-full transition-opacity duration-150 ease-standard hover:opacity-80", STATUS_DOT[status])}
                  />
                </span>
              ) : (
                <span aria-hidden="true" className="h-2 w-px bg-border-strong" />
              )}
            </span>
            <span className="w-6 shrink-0 text-right font-semibold text-text tabular-nums">{counts[status]}</span>
            <span className="w-9 shrink-0 text-right text-text-subtle tabular-nums">{share(status)}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
