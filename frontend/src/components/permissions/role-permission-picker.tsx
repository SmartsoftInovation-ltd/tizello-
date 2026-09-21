"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { PermissionGroup } from "@/types/permissions";

/**
 * The permission list inside the role dialog: one checkbox per action, under
 * its area, with an All / None control on each area heading.
 *
 * A `<fieldset>` per group, so a screen reader announces "Workspace" before
 * the boxes rather than reading twelve unrelated labels.
 *
 * THE AREA CONTROL IS NOT A TRI-STATE CHECKBOX. A half-ticked box that means
 * "some" has to be clicked twice to reach a known state and reads as
 * indeterminate to assistive tech; two plain buttons say what they do and land
 * on the state named. It is also what makes "this role is read-only across the
 * workspace" two clicks rather than twelve.
 */
const AREA_BUTTON =
  "rounded-xs px-1 text-2xs font-medium text-text-subtle transition-colors duration-100 ease-standard hover:text-text-brand";

export function RolePermissionPicker({
  groups,
  allowed,
  onToggle,
  onToggleArea,
}: {
  groups: PermissionGroup[];
  allowed: readonly string[];
  onToggle: (actionId: string) => void;
  onToggleArea: (group: PermissionGroup, grant: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const held = group.actions.filter((action) =>
          allowed.includes(action.id),
        ).length;

        return (
          <fieldset key={group.area}>
            <div className="flex items-center justify-between gap-2">
              <legend className="text-2xs font-semibold tracking-widest text-text-subtle uppercase">
                {group.label}
              </legend>

              <div className="flex items-center gap-1">
                <span className="text-2xs tabular-nums text-text-subtle">
                  {held}/{group.actions.length}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleArea(group, true)}
                  className={AREA_BUTTON}
                >
                  All
                  <span className="sr-only"> {group.label} permissions</span>
                </button>
                <span aria-hidden="true" className="text-2xs text-text-subtle">
                  /
                </span>
                <button
                  type="button"
                  onClick={() => onToggleArea(group, false)}
                  className={AREA_BUTTON}
                >
                  None
                  <span className="sr-only"> of the {group.label} permissions</span>
                </button>
              </div>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {group.actions.map((action) => (
                <Checkbox
                  key={action.id}
                  name={action.id}
                  label={action.label}
                  checked={allowed.includes(action.id)}
                  onChange={() => onToggle(action.id)}
                />
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
