import { PointsIcon } from "@/components/ui/points-icon";
import { cn } from "@/lib/cn";
import type { PointsByGroup } from "@/lib/sprint-plan";

/**
 * Story points across a sprint: the total first, then To do / In progress /
 * Done, and against the sprint's capacity when one is set.
 *
 * ONE TAG, TWO HALVES. The total is what a planning session is steering by, so
 * it leads in full ink beside the same diamond the row estimates carry; a
 * hairline divides it from the three per-group counts, which keep a status dot
 * each because that is the convention the status chips already teach. The
 * fill is `surface-hover`, the same rest fill as the row estimates and kebabs.
 *
 * With a capacity, a thin meter sits under the total so "how full" reads
 * without doing the division. Over capacity the total and meter turn `danger`
 * and say by how much — a fact to notice, not a block. Unestimated tasks get
 * their own dashed tag: those points are unknown, not zero.
 */
const DOT = "size-1.5 shrink-0 rounded-full";

function Count({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <span title={`${label}: ${value} pts`} className="inline-flex items-center gap-1">
      <span aria-hidden="true" className={cn(DOT, dot)} />
      {value}
    </span>
  );
}

export function SprintPoints({ points, capacity }: { points: PointsByGroup; capacity: number | null }) {
  const over = capacity !== null && points.total > capacity;
  const fill = capacity ? Math.min(100, Math.round((points.total / capacity) * 100)) : 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="sr-only">
        {capacity === null ? `${points.total} points` : `${points.total} of ${capacity} points`}
        {over ? `, ${points.total - capacity} over capacity` : ""}. {points.TODO} to do,{" "}
        {points.IN_PROGRESS} in progress, {points.COMPLETE} done.
      </span>

      <span
        aria-hidden="true"
        className="inline-flex h-7 items-center overflow-hidden rounded-sm bg-surface-hover text-2xs font-semibold tabular-nums"
      >
        <span
          title={capacity === null ? "Total story points" : "Total story points / capacity"}
          className={cn("flex h-full flex-col justify-center gap-0.5 px-2", over ? "text-danger" : "text-text")}
        >
          <span className="inline-flex items-center gap-1">
            <PointsIcon className="size-3 shrink-0" />
            {points.total}
            {capacity !== null && <span className={over ? undefined : "text-text-subtle"}>/ {capacity}</span>}
            <span className={over ? undefined : "font-medium text-text-subtle"}>
              pts{over ? ` · +${points.total - capacity}` : ""}
            </span>
          </span>
          {capacity !== null && (
            <span className="block h-0.5 w-full overflow-hidden rounded-full bg-border">
              <span
                className={cn("block h-full rounded-full", over ? "bg-danger" : "bg-brand-500")}
                style={{ width: `${fill}%` }}
              />
            </span>
          )}
        </span>

        <span className="h-3.5 w-px bg-border" />

        <span className="inline-flex items-center gap-2.5 px-2 text-text-muted">
          <Count label="To do" value={points.TODO} dot="bg-text-subtle" />
          <Count label="In progress" value={points.IN_PROGRESS} dot="bg-info" />
          <Count label="Done" value={points.COMPLETE} dot="bg-success" />
        </span>
      </span>

      {points.unestimated > 0 && (
        <span
          title="Tasks with no story points yet"
          className="inline-flex h-7 items-center rounded-sm border border-dashed border-border-strong px-2 text-2xs font-medium text-text-subtle"
        >
          {points.unestimated} unestimated
        </span>
      )}
    </div>
  );
}
