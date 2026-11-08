"use client";

import {
  PERMISSION_HINTS,
  PermissionAreaIcon,
} from "@/components/permissions/permission-area-meta";
import { cn } from "@/lib/cn";
import type { PermissionGroup } from "@/types/permissions";

/*
 * One area of the role editor's permission list: a header with the area's
 * icon, how many of its actions are on, and one Select all / Clear button, then
 * a row per action.
 *
 * EACH ROW IS THE WHOLE LABEL. The native checkbox stays — it keeps the
 * browser's own focus ring, keyboard toggle and checked semantics — but the
 * click target is the full row with its explanation, not a 16px box.
 *
 * ONE AREA BUTTON, not "All / None". It says what it will do next ("Select all"
 * until every action is on, then "Clear"), so it is never a no-op, and the area
 * still lands on a known state in one click — the reason the old pair existed.
 */
const ROW =
  "flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors duration-100 ease-standard hover:bg-surface-hover";

export function PermissionAreaCard({
  className,
  group,
  allowed,
  onToggle,
  onToggleArea,
}: {
  group: PermissionGroup;
  allowed: readonly string[];
  onToggle: (actionId: string) => void;
  onToggleArea: (group: PermissionGroup, grant: boolean) => void;
  /** Grid placement from the picker; the card fills whatever height its row has. */
  className?: string;
}) {
  const held = group.actions.filter((action) => allowed.includes(action.id)).length;
  const full = held === group.actions.length;

  return (
    <fieldset className={cn("flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-surface", className)}>
      <div className="flex items-center gap-2.5 border-b border-border bg-surface-sunken px-3 py-2">
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-md",
            held > 0 ? "bg-brand-subtle text-text-brand" : "bg-surface text-text-subtle",
          )}
        >
          <PermissionAreaIcon area={group.area} className="size-4" />
        </span>
        <legend className="contents">
          <span className="text-sm font-semibold text-text">{group.label}</span>
        </legend>
        <span
          className={cn(
            "rounded-full px-1.5 text-2xs font-medium tabular-nums",
            held > 0 ? "bg-brand-subtle text-text-brand" : "bg-chip text-text-subtle",
          )}
        >
          {held}/{group.actions.length}
        </span>
        <button
          type="button"
          onClick={() => onToggleArea(group, !full)}
          className="ml-auto rounded-sm px-1.5 py-0.5 text-xs font-medium text-text-muted transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text-brand"
        >
          {full ? "Clear" : "Select all"}
          <span className="sr-only"> {group.label} permissions</span>
        </button>
      </div>

      <div className="flex-1 divide-y divide-border">
        {group.actions.map((action) => {
          const checked = allowed.includes(action.id);
          const hint = PERMISSION_HINTS[action.id];

          return (
            <label key={action.id} className={ROW}>
              <input
                type="checkbox"
                name={action.id}
                checked={checked}
                onChange={() => onToggle(action.id)}
                className="mt-0.5 size-4 shrink-0 rounded-xs border-border accent-brand-500"
              />
              <span className="min-w-0">
                <span className={cn("block text-sm", checked ? "font-medium text-text" : "text-text-muted")}>
                  {action.label}
                </span>
                {hint && <span className="mt-0.5 block text-xs text-text-subtle">{hint}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
