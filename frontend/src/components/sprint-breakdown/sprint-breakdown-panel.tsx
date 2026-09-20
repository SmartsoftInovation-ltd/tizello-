import Link from "next/link";
import { AssigneeLoadChart } from "@/components/sprint-breakdown/assignee-load-chart";
import { BreakdownChartNav } from "@/components/sprint-breakdown/breakdown-chart-nav";
import { SprintGantt } from "@/components/sprint-breakdown/sprint-gantt";
import { StatusShareDonut, StatusShareLegend } from "@/components/sprint-breakdown/status-share-donut";
import { TaskProgressTable } from "@/components/sprint-breakdown/task-progress-table";
import type { TaskScope } from "@/components/tasks/task-draft";
import { activeSprint, sprintTasks } from "@/lib/current-sprint";
import { assigneeLoad, ganttRows, statusShares, todayPercent } from "@/lib/sprint-breakdown";
import { BREAKDOWN_CHART_LABEL, type BreakdownChart } from "@/lib/sprint-breakdown-view";
import { pointsByGroup } from "@/lib/sprint-plan";
import type { Task } from "@/types/task";

/**
 * The current sprint, measured rather than worked: one of three charts over the
 * running sprint's tasks, with the per-task table under it.
 *
 * A SERVER COMPONENT, and the whole screen ships no JavaScript. The chart
 * choice is a URL param rather than state (`sprint-breakdown-view.ts`), so
 * there is nothing here that needs a browser — which is also what keeps this
 * screen off the board's drag-and-drop bundle.
 *
 * THE TABLE IS ALWAYS UNDER THE CHART, on every view. It is the chart's
 * accessibility twin: every value any chart draws is real text down there, so
 * the team's own status hues — decorative `label-*` colours that no
 * colour-blind reader can reliably separate — never become the only way to
 * read a number.
 *
 * READ-ONLY on purpose. Everything here is editable one click away on the
 * board; a second place to drag a card is a second place for the two to
 * disagree.
 */
export function SprintBreakdownPanel({ tasks, scope, chart, projectId }: { tasks: Task[]; scope: TaskScope; chart: BreakdownChart; projectId: string }) {
  const sprint = activeSprint(scope.sprints);

  if (!sprint) {
    return (
      <Empty title="No sprint is running">
        <Link href={`/board/sprint-planning?project=${projectId}`} className="text-xs font-medium text-text-brand hover:underline">
          Start one from sprint planning &rarr;
        </Link>
      </Empty>
    );
  }

  const mine = sprintTasks(tasks, sprint.id);
  const points = pointsByGroup(mine);

  if (mine.length === 0) {
    return <Empty title={`${sprint.name} has no tasks yet`}>There is nothing to break down until work is planned into it.</Empty>;
  }

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-2">
      <section className="rounded-lg border border-border bg-surface p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-text">
              {sprint.name} &middot; {BREAKDOWN_CHART_LABEL[chart]}
            </h2>
            <p className="mt-0.5 text-xs text-text-muted tabular-nums">
              {mine.length} {mine.length === 1 ? "task" : "tasks"} &middot; {points.COMPLETE} of {points.total} pts done
              {points.unestimated > 0 && ` · ${points.unestimated} unestimated`}
            </p>
          </div>
          <BreakdownChartNav current={chart} projectId={projectId} />
        </div>

        <div className="mt-6">
          <Chart chart={chart} tasks={mine} scope={scope} startDate={sprint.startDate} endDate={sprint.endDate} />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-text">Every task</h2>
        <p className="mt-0.5 text-xs text-text-muted">How far each one has moved through this project&rsquo;s statuses.</p>
        <div className="mt-4">
          <TaskProgressTable tasks={mine} statuses={scope.statuses} today={scope.today} />
        </div>
      </section>
    </div>
  );
}

function Chart({
  chart,
  tasks,
  scope,
  startDate,
  endDate,
}: {
  chart: BreakdownChart;
  tasks: Task[];
  scope: TaskScope;
  startDate: string | null;
  endDate: string | null;
}) {
  if (chart === "bar") return <AssigneeLoadChart rows={assigneeLoad(tasks)} />;

  if (chart === "gantt") {
    /* A sprint can be started without dates, and a timeline with no window is
       not a chart with a gap in it — it is a chart that cannot be drawn. Say
       which fact is missing rather than rendering an empty grid. */
    if (!startDate || !endDate) {
      return <p className="text-sm text-text-muted">This sprint has no start and end date, so there is no window to lay the tasks out on.</p>;
    }

    return (
      <SprintGantt
        rows={ganttRows(tasks, startDate, endDate)}
        startDate={startDate}
        endDate={endDate}
        todayAt={todayPercent(startDate, endDate, scope.today)}
      />
    );
  }

  const shares = statusShares(tasks, scope.statuses);
  const spoken = shares.filter((slice) => slice.count > 0).map((slice) => `${slice.name} ${slice.count} (${slice.percent}%)`);

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
      <StatusShareDonut shares={shares} total={tasks.length} label={`Status share of ${tasks.length} tasks: ${spoken.join(", ")}.`} />
      <StatusShareLegend shares={shares} />
    </div>
  );
}

function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-lg border border-dashed border-border bg-panel px-4 py-12 text-center">
      <p className="text-sm font-semibold text-text">{title}</p>
      <p className="mt-1 text-xs text-text-muted">{children}</p>
    </div>
  );
}
