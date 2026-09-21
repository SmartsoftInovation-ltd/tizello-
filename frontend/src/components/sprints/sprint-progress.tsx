import { PROGRESS_FILL } from "@/components/sprints/sprint-tone";
import { cn } from "@/lib/cn";
import { donePercent } from "@/lib/sprint-groups";
import type { SprintRecord } from "@/types/sprint";

/*
 * How much of the sprint is done: a rail, a fill, and the same numbers written
 * out beside it.
 *
 * The bar is `aria-hidden`. Its width is the visual encoding of "3 of 8", which
 * the label already states as real text, so announcing it twice would only add
 * noise — the same call `TimelineRow` makes about its bar. `role="progressbar"`
 * would be the alternative, and it would say the identical thing a second time.
 *
 * `width` is `style` because it is a computed percentage — the one dynamic
 * value the house rules allow. Everything else is a utility.
 */
export function SprintProgress({
  sprint,
}: {
  /* Narrowed to what the bar reads, so the live sprints list can hand it the
     API's counts without inventing the rest of a `SprintRecord`. */
  sprint: Pick<SprintRecord, "doneCount" | "itemCount" | "state">;
}) {
  const percent = donePercent(sprint);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs tabular-nums text-text-muted">
          {sprint.doneCount} of {sprint.itemCount} done
        </span>
        <span className="text-2xs font-semibold tabular-nums text-text-subtle">
          {percent}%
        </span>
      </div>

      <div
        aria-hidden="true"
        className="mt-1 h-1.5 w-full overflow-hidden rounded-xs bg-surface-sunken"
      >
        <span
          style={{ width: `${percent}%` }}
          className={cn(
            "block h-full rounded-xs transition-[width] duration-100 ease-standard",
            PROGRESS_FILL[sprint.state],
          )}
        />
      </div>
    </div>
  );
}
