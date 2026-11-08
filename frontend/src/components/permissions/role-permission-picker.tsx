"use client";

import { PermissionAreaCard } from "@/components/permissions/permission-area-card";
import type { PermissionGroup } from "@/types/permissions";

/**
 * The permission list inside the role editor: a section heading with the
 * running total, then one card per area (`PermissionAreaCard`).
 *
 * A `<fieldset>` per area, so a screen reader announces "Workspace" before
 * its rows rather than reading twelve unrelated labels.
 *
 * THE AREA CONTROL IS NOT A TRI-STATE CHECKBOX. A half-ticked box that means
 * "some" has to be clicked twice to reach a known state and reads as
 * indeterminate to assistive tech; a button that names its result lands on the
 * state named. It is also what makes "this role is read-only across the
 * workspace" a few clicks rather than twelve.
 */
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
  const total = groups.reduce((sum, group) => sum + group.actions.length, 0);
  const held = groups.reduce(
    (sum, group) => sum + group.actions.filter((action) => allowed.includes(action.id)).length,
    0,
  );

  return (
    <section aria-labelledby="role-permissions-heading">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="role-permissions-heading" className="text-xs font-semibold text-text">
          Permissions
        </h3>
        <span className="text-xs tabular-nums text-text-subtle" aria-live="polite">
          {held} of {total} selected
        </span>
      </div>
      <p className="mt-0.5 text-xs text-text-subtle">
        Pick what people with this role are allowed to do.
      </p>

      {/* A six-track grid at `xl`: multi-action areas take a third of the row
          and single-action areas half, so Workspace / Members / Projects share
          one line and Tasks & sprints / Roles the next. Rows stretch, so every
          card on a line ends at the same height. Complete class strings only —
          see DESIGN-SYSTEM.md on interpolated classes. */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-6">
        {groups.map((group) => (
          <PermissionAreaCard
            key={group.area}
            className={group.actions.length > 1 ? "xl:col-span-2" : "xl:col-span-3"}
            group={group}
            allowed={allowed}
            onToggle={onToggle}
            onToggleArea={onToggleArea}
          />
        ))}
      </div>
    </section>
  );
}
