import { cn } from "@/lib/cn";
import type { PermissionGroup, RoleDefinition } from "@/types/permissions";

/*
 * What a role can do, as one line of area chips — `Workspace 2/4`,
 * `Members 4/4`, and the areas it holds nothing in greyed rather than hidden.
 *
 * GREYED, NOT HIDDEN, and that is the whole design of this component. A card
 * listing only the areas a role touches reads as a complete answer, so a reader
 * cannot tell "Reviewer has no member permissions" from "the card ran out of
 * room". Showing every area with its fraction makes a zero a statement.
 *
 * A full area gets the tinted fill; a partial one the neutral chip with its
 * fraction; an empty one the same chip dimmed. Neutral ink throughout, per the
 * contrast table in DESIGN-SYSTEM.md — a `-subtle` fill does not pair with its
 * own strong token at this size.
 *
 * No JavaScript: it renders from props and nothing here is interactive.
 */
const CHIP = "rounded-xs px-1.5 py-0.5 text-2xs whitespace-nowrap tabular-nums";
const FULL = "bg-brand-subtle text-text-muted font-medium";
const PARTIAL = "bg-surface-sunken text-text-muted";
const NONE = "bg-surface-sunken text-text-subtle opacity-60";

export function RolePermissionChips({
  role,
  groups,
}: {
  role: RoleDefinition;
  groups: PermissionGroup[];
}) {
  if (groups.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-1">
      {groups.map((group) => {
        const total = group.actions.length;
        const held = group.actions.filter((action) =>
          role.permissions.includes(action.id),
        ).length;

        const tone = held === total ? FULL : held === 0 ? NONE : PARTIAL;

        return (
          <li key={group.area}>
            <span className={cn(CHIP, tone)}>
              <span aria-hidden="true">
                {group.label} {held}/{total}
              </span>
              {/* Read aloud as a sentence rather than four numbers in a row. */}
              <span className="sr-only">
                {group.label}: {held} of {total} allowed
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
