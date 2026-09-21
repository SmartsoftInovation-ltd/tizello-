"use client";

import { RoleCard } from "@/components/permissions/role-card";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";
import { LockedControl } from "@/components/ui/locked-control";
import { plural } from "@/lib/plural";
import type { PermissionGroup, RoleDefinition } from "@/types/permissions";

/**
 * The role strip: every role in the workspace, and the one control that adds
 * another.
 *
 * Two columns from `sm` rather than four from `lg`: the cards carry a line of
 * area chips now, and four of those across a wide screen squeezed every chip
 * onto its own row. Three from `xl`, where there is genuinely room.
 *
 * The cards FILL their column — see the `w-full` note in `role-card.tsx` — so
 * the only space between them is this `gap`, and it is deliberately tighter
 * than the page's usual `gap-3`: these are three readings of one table, not
 * three unrelated tiles, and a wide gutter made them read as separate.
 *
 * "New role" is a `LockedControl` for a viewer without `roles.manage` rather
 * than hidden — a control that vanishes leaves someone wondering whether the
 * feature exists, and the reason travels as a tooltip and in the accessible
 * name. The server enforces regardless.
 */
export function RoleCards({
  roles,
  groups,
  memberCounts,
  actionCount,
  canManage,
  onCreate,
  onEdit,
  onDelete,
}: {
  roles: RoleDefinition[];
  groups: PermissionGroup[];
  memberCounts: Record<string, number>;
  actionCount: number;
  canManage: boolean;
  onCreate: () => void;
  onEdit: (role: RoleDefinition) => void;
  onDelete: (role: RoleDefinition) => void;
}) {
  const custom = roles.filter((role) => !role.builtIn).length;

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-text">Roles</h2>
          <p className="mt-0.5 text-2xs text-text-subtle">
            {plural(roles.length, "role", "roles")}
            {custom > 0 && <> &middot; {custom} defined by this workspace</>}
          </p>
        </div>

        {canManage ? (
          <Button size="sm" onClick={onCreate}>
            <PlusIcon className="size-3.5" />
            New role
          </Button>
        ) : (
          <LockedControl
            reason="Only an owner or admin can define roles"
            label="New role"
            className="gap-1 rounded-sm px-2.5 py-1.5 text-xs font-medium text-text-muted"
          >
            <PlusIcon className="size-3.5" />
            New role
          </LockedControl>
        )}
      </div>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => (
          <li key={role.id} className="flex">
            <RoleCard
              role={role}
              groups={groups}
              memberCount={memberCounts[role.id] ?? 0}
              actionCount={actionCount}
              canManage={canManage}
              onEdit={() => onEdit(role)}
              onDelete={() => onDelete(role)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
