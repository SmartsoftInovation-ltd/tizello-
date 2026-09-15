import { BADGE_BASE } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

/*
 * The estimate chip — "5 pts".
 *
 * Neutral, never tinted: priority already owns a colour on this row, and a
 * second coloured chip would compete with it for the same glance. `tabular-nums`
 * keeps a column of them from twitching between 8 and 13.
 */
const CHIP = "bg-chip text-text-muted tabular-nums";

export function StoryPointsBadge({ points }: { points?: number }) {
  /* Unestimated is not zero, and "0 pts" would claim it is. The row renders
     nothing at all instead. */
  if (!points) return null;

  return (
    <span className={cn(BADGE_BASE, CHIP)}>
      {/* The abbreviation is fine to read but not to hear, so the two spellings
          are two elements. `sr-only` is absolutely positioned and therefore out
          of the flex flow — it adds no second gap next to the visible one. */}
      <span aria-hidden="true">{points} pts</span>
      <span className="sr-only">
        {points} {points === 1 ? "story point" : "story points"}
      </span>
    </span>
  );
}
