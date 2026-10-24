import { OverviewStats } from "@/components/workspace/dashboard/overview-stats";
import { ProjectsStatusChart } from "@/components/workspace/dashboard/projects-status-chart";
import { TaskProgressChart } from "@/components/workspace/dashboard/task-progress-chart";
import { TaskProgressTable } from "@/components/workspace/dashboard/task-progress-table";
import type { WorkspaceOverview } from "@/lib/workspace-overview";

/*
 * The overview at the top of `/workspaces`: headline figures, then the two
 * charts side by side, then the table twin — one panel, not a grid of cards.
 *
 * ONE SURFACE, HAIRLINE SEAMS. The stat tiles and charts share a single
 * bordered panel divided by 1px seams (`gap-px` over a border-coloured
 * backing), rather than five floating cards with five shadows: the frontend-
 * design skill names the identical-card kit as the most generic dashboard
 * look, and the data — not the chrome — should be the loud part.
 *
 * A Server Component end to end: the numbers come from one aggregate request
 * (`GET /workspaces/overview`), the charts are HTML, and their tooltips are
 * CSS, so this section ships no JavaScript.
 */
export function WorkspaceDashboard({ overview }: { overview: WorkspaceOverview }) {
  return (
    <section aria-label="Overview" className="mb-8 overflow-hidden rounded-lg border border-border bg-surface">
      <OverviewStats totals={overview.totals} />

      <div className="grid gap-px bg-border lg:grid-cols-[3fr_2fr]">
        <div className="bg-surface">
          <TaskProgressChart rows={overview.workspaces} />
        </div>
        <div className="bg-surface">
          <ProjectsStatusChart counts={overview.projectsByStatus} />
        </div>
      </div>

      <TaskProgressTable rows={overview.workspaces} />
    </section>
  );
}
