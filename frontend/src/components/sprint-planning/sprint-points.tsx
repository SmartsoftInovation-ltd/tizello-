import { cn } from "@/lib/cn";
import type { PointsByGroup } from "@/lib/sprint-plan";

/**
 * Story points across a sprint, three ways — To do, In progress, Done — and
 * against the sprint's capacity when one is set.
 *
 * ONE QUIET CHIP with a coloured dot per group, not three filled pills. The
 * three bare numbers ("2 0 0") read as noise in light mode and said nothing
 * without hovering; a dot of the status colour beside each number is the
 * convention the status chips already teach. The fill stays neutral (`surface`
 * with a hairline) so it sits calmly on the panel in both themes, and the
 * words are in the accessible name and each `title`. Over capacity, the total
 * turns `danger` and says by how much — a fact to notice, not a block.
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

  return (
    <div className="flex items-center gap-2">
      <span className="sr-only">
        {points.TODO} points to do, {points.IN_PROGRESS} in progress, {points.COMPLETE} done.
      </span>
      <span
        aria-hidden="true"
        className="inline-flex h-6 items-center gap-2.5 rounded-full border border-border bg-surface px-2.5 text-2xs font-semibold text-text-muted tabular-nums"
      >
        <Count label="To do" value={points.TODO} dot="bg-text-subtle" />
        <Count label="In progress" value={points.IN_PROGRESS} dot="bg-info" />
        <Count label="Done" value={points.COMPLETE} dot="bg-success" />
      </span>

      <span className={cn("text-xs tabular-nums", over ? "font-semibold text-danger" : "font-medium text-text-muted")}>
        {capacity === null
          ? `${points.total} pts`
          : `${points.total} / ${capacity} pts${over ? ` · ${points.total - capacity} over` : ""}`}
      </span>
      {points.unestimated > 0 && <span className="text-xs text-text-subtle">· {points.unestimated} unestimated</span>}
    </div>
  );
}
