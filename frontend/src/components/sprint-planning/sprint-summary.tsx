import { daysInclusive, daysRemaining } from "@/lib/sprint-dates";
import type { PointsByGroup } from "@/lib/sprint-plan";
import type { ProjectSprint } from "@/types/project-sprint";

/**
 * What is in a sprint, at a glance — the top of the sprint drawer for a sprint
 * that exists: tasks, points by status as one stacked bar, capacity, and time.
 *
 * ONE STACKED BAR rather than three numbers, because the question it answers is
 * proportional ("how much of this is done?"), and a bar answers that before
 * anyone reads a digit. The numbers sit beside it for anyone who wants them;
 * the fill colours are recognition only. `style` carries the widths — they are
 * computed, which is the one case the house rules allow it for.
 */
const BAR = "block h-full transition-[width] duration-100 ease-standard";

export function SprintSummary({
  sprint,
  count,
  points,
  today,
}: {
  sprint: ProjectSprint;
  count: number;
  points: PointsByGroup;
  today: string;
}) {
  const scale = Math.max(points.total, sprint.capacityPoints ?? 0, 1);
  const width = (value: number) => `${(value / scale) * 100}%`;
  const over = sprint.capacityPoints !== null && points.total > sprint.capacityPoints;

  const time =
    sprint.startDate && sprint.endDate
      ? sprint.state === "ACTIVE"
        ? `${Math.max(0, daysRemaining(today, sprint.endDate))} days left of ${daysInclusive(sprint.startDate, sprint.endDate)}`
        : `${daysInclusive(sprint.startDate, sprint.endDate)} days`
      : "No dates yet";

  return (
    <section aria-label="Sprint summary" className="mt-5 rounded-md border border-border p-3">
      <dl className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <dt className="text-text-subtle">Tasks</dt>
          <dd className="mt-0.5 text-sm font-semibold text-text tabular-nums">{count}</dd>
        </div>
        <div>
          <dt className="text-text-subtle">Points</dt>
          <dd className={over ? "mt-0.5 text-sm font-semibold text-danger tabular-nums" : "mt-0.5 text-sm font-semibold text-text tabular-nums"}>
            {points.total}
            {sprint.capacityPoints !== null && <span className="font-normal text-text-subtle"> / {sprint.capacityPoints}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-text-subtle">Time</dt>
          <dd className="mt-0.5 text-sm font-semibold text-text">{time}</dd>
        </div>
      </dl>

      <div aria-hidden="true" className="mt-3 flex h-2 overflow-hidden rounded-xs bg-surface-sunken">
        <span style={{ width: width(points.COMPLETE) }} className={`${BAR} bg-success`} />
        <span style={{ width: width(points.IN_PROGRESS) }} className={`${BAR} bg-info`} />
        <span style={{ width: width(points.TODO) }} className={`${BAR} bg-text-subtle/40`} />
      </div>
      <p className="mt-1.5 text-2xs text-text-subtle">
        {points.COMPLETE} done · {points.IN_PROGRESS} in progress · {points.TODO} to do
        {points.unestimated > 0 && ` · ${points.unestimated} unestimated`}
        {over && ` · ${points.total - (sprint.capacityPoints ?? 0)} over capacity`}
      </p>
    </section>
  );
}
