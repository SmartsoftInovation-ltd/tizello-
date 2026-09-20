import Link from "next/link";
import { BREAKDOWN_CHARTS, BREAKDOWN_CHART_LABEL, breakdownHref, type BreakdownChart } from "@/lib/sprint-breakdown-view";

/*
 * The three charts as a tab strip — styled like `ProjectsViewNav` and
 * `SprintWorkflowNav` so every strip in the app reads as the same control.
 *
 * NAVIGATION, not a tabs widget: each option is a different URL, so these are
 * real `<a>`s in a `<nav>` with `aria-current`, and the strip ships no
 * JavaScript. A chart choice is then shareable and survives a reload, which a
 * `useState` toggle would not manage.
 *
 * The project rides along in every href — switching chart must not silently
 * drop you back to the first project in the workspace.
 */
const ACTIVE = "inline-block border-b-2 border-brand-500 px-2 pb-1.5 text-xs font-semibold text-text";
const IDLE =
  "inline-block border-b-2 border-transparent px-2 pb-1.5 text-xs font-medium text-text-muted transition-colors duration-100 ease-standard hover:border-border-strong hover:text-text";

export function BreakdownChartNav({ current, projectId }: { current: BreakdownChart; projectId?: string }) {
  return (
    <nav aria-label="Breakdown charts" className="min-w-0">
      <ul className="scrollbar-board flex items-center gap-1 overflow-x-auto">
        {BREAKDOWN_CHARTS.map((chart) => (
          <li key={chart}>
            <Link
              href={breakdownHref(chart, projectId)}
              aria-current={chart === current ? "page" : undefined}
              className={chart === current ? ACTIVE : IDLE}
            >
              {BREAKDOWN_CHART_LABEL[chart]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
