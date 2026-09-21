import { BADGE_BASE } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/plural";
import type { SprintRecord } from "@/types/sprint";

/*
 * What is in the sprint: how many tasks, and what they add up to.
 *
 * Both chips are neutral. The state chip on the same row already owns a colour,
 * and a second tinted pill would compete with it for the same glance —
 * `StoryPointsBadge` makes the identical call on a backlog row, and this is the
 * same number in the same typeface.
 *
 * A sprint with nothing in it says so. `0 items · 0 pts` is technically true
 * and reads as a bug; "Nothing planned yet" is the sentence a booked, empty
 * time-box actually deserves.
 */
const CHIP = "bg-surface-sunken text-text-muted tabular-nums";

export function SprintCounts({
  sprint,
}: {
  /* The two roll-ups it reads, not a whole record — so the live sprints list
     can pass an API `ProjectSprint`'s `taskCount` under the same chip. */
  sprint: Pick<SprintRecord, "itemCount" | "totalPoints">;
}) {
  if (sprint.itemCount === 0) {
    return (
      <p className="text-2xs text-text-subtle italic">
        Nothing planned into it yet
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={cn(BADGE_BASE, CHIP)}>
        {plural(sprint.itemCount, "item", "items")}
      </span>

      {/* Unestimated is not zero, and "0 pts" would claim it is — so a sprint
          nobody has sized renders no points chip at all. */}
      {sprint.totalPoints > 0 && (
        <span className={cn(BADGE_BASE, CHIP)}>
          <span aria-hidden="true">{sprint.totalPoints} pts</span>
          <span className="sr-only">
            {sprint.totalPoints} story points
          </span>
        </span>
      )}
    </div>
  );
}
