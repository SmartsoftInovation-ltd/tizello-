import { ProgressCell } from "@/components/current-sprint/progress-cell";
import { STATUS_DOT } from "@/components/tasks/task-tone";
import { cn } from "@/lib/cn";
import { sliceWidths, type StatusSlice } from "@/lib/sprint-progress";
import type { PointsByGroup } from "@/lib/sprint-plan";

/**
 * WORK: one bar segment per status, in the status's own colour and in board
 * order, with a legend naming each status and its points. Moving a card
 * between columns moves its share between segments on the same render.
 *
 * "% done" is the Complete GROUP's share of the points — a status named
 * "Done" that sits in another group does not count, by design.
 * Segment widths are genuinely dynamic, so they are the one `style` here.
 */
export function SprintWorkCell({
  points,
  slices,
  capacity,
}: {
  points: PointsByGroup;
  slices: StatusSlice[];
  capacity: number | null;
}) {
  const done = points.total > 0 ? Math.round((points.COMPLETE / points.total) * 100) : 0;
  const over = capacity !== null && points.total > capacity;
  const widths = sliceWidths(slices);

  return (
    <ProgressCell
      label="Work"
      value={
        <>
          <span className="font-semibold text-text">{done}%</span> done ·{" "}
          <span className={cn(over && "font-semibold text-danger")}>
            {points.total}
            {capacity !== null ? ` / ${capacity}` : ""} pts
          </span>
        </>
      }
      caption={
        <>
          {slices.map((slice) => (
            <span key={slice.id} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className={cn("size-2 rounded-full", STATUS_DOT[slice.color])} />
              {slice.name}
              <span className="font-semibold text-text tabular-nums">{slice.points}</span>
            </span>
          ))}
          {slices.length === 0 && <span className="text-text-subtle">No cards in this sprint yet</span>}
          {points.unestimated > 0 && <span className="text-text-subtle">{points.unestimated} unestimated</span>}
        </>
      }
    >
      {slices.map((slice, index) =>
        widths[index] > 0 ? (
          <span
            key={slice.id}
            title={`${slice.name}: ${slice.points} pts · ${slice.count} ${slice.count === 1 ? "card" : "cards"}`}
            className={cn("transition-[width] duration-500 ease-standard", STATUS_DOT[slice.color])}
            style={{ width: `${widths[index]}%` }}
          />
        ) : null,
      )}
    </ProgressCell>
  );
}
