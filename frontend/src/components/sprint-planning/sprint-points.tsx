import { cn } from "@/lib/cn";
import type { PointsByGroup } from "@/lib/sprint-plan";

/**
 * Story points across a sprint, three ways — To do, In progress, Done — and
 * against the sprint's capacity when one is set.
 *
 * Three pills, the way Jira's sprint header shows them, because "how much is
 * in it" and "how much is left" are different questions in an active sprint.
 * The word is in the accessible name and the `title`; the fill is recognition
 * only. Over capacity, the total turns to `danger` and says by how much — a
 * forecast being exceeded is a fact to notice, not a block.
 */
const PILL = "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-2xs font-semibold tabular-nums text-text-muted";

export function SprintPoints({ points, capacity }: { points: PointsByGroup; capacity: number | null }) {
  const over = capacity !== null && points.total > capacity;

  return (
    <div className="flex items-center gap-1.5">
      <span className="sr-only">
        {points.TODO} points to do, {points.IN_PROGRESS} in progress, {points.COMPLETE} done.
      </span>
      <span aria-hidden="true" title="To do" className={cn(PILL, "border border-border bg-surface")}>
        {points.TODO}
      </span>
      <span aria-hidden="true" title="In progress" className={cn(PILL, "bg-info-subtle")}>
        {points.IN_PROGRESS}
      </span>
      <span aria-hidden="true" title="Done" className={cn(PILL, "bg-success-subtle")}>
        {points.COMPLETE}
      </span>

      <span className={cn("ml-1 text-2xs tabular-nums", over ? "font-semibold text-danger" : "text-text-subtle")}>
        {capacity === null
          ? `${points.total} pts`
          : `${points.total} / ${capacity} pts${over ? ` · ${points.total - capacity} over` : ""}`}
      </span>
      {points.unestimated > 0 && (
        <span className="text-2xs text-text-subtle">· {points.unestimated} unestimated</span>
      )}
    </div>
  );
}
