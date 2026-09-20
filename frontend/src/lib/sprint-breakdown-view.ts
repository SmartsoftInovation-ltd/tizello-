/*
 * The breakdown screen's chart selection, as a URL param — the same shape
 * `project-view.ts` gives the projects screen's five views, for the same
 * reasons: the choice survives a reload and a paste into Slack, and the
 * switcher ships no JavaScript because every option is a real link.
 */

/** Declaration order is the order of the tabs. */
export const BREAKDOWN_CHARTS = ["pie", "bar", "gantt"] as const;
export type BreakdownChart = (typeof BREAKDOWN_CHARTS)[number];

/**
 * Tabs are named for the QUESTION each chart answers, not for its shape. "Pie
 * chart" tells a reader what it looks like; "Status share" tells them which
 * one to click.
 */
export const BREAKDOWN_CHART_LABEL: Record<BreakdownChart, string> = {
  pie: "Status share",
  bar: "Workload",
  gantt: "Timeline",
};

export const DEFAULT_BREAKDOWN_CHART: BreakdownChart = "pie";

/** Anything unrecognised falls back rather than 404s — a stale link still opens. */
export function parseBreakdownChart(value: string | string[] | undefined): BreakdownChart {
  const found = BREAKDOWN_CHARTS.find((chart) => chart === value);
  return found ?? DEFAULT_BREAKDOWN_CHART;
}

/**
 * The link for one tab, carrying the project along.
 *
 * DEFAULTS ARE WRITTEN AS ABSENCES — no `?chart=pie` — so one view has exactly
 * one URL and the address bar stays short. `project-view.ts` takes the same
 * line; `params.sort()` keeps the two params in a stable order so the same
 * view never produces two different strings.
 */
export function breakdownHref(chart: BreakdownChart, projectId?: string): string {
  const params = new URLSearchParams();
  if (projectId) params.set("project", projectId);
  if (chart !== DEFAULT_BREAKDOWN_CHART) params.set("chart", chart);
  params.sort();

  const query = params.toString();
  return query ? `/board/sprint/breakdown?${query}` : "/board/sprint/breakdown";
}
