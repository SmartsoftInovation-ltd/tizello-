"use client";

import { RolePermissionChips } from "@/components/permissions/role-permission-chips";
import { Card } from "@/components/ui/card";
import { PencilIcon, TrashIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/plural";
import type { PermissionGroup, RoleDefinition } from "@/types/permissions";

/*
 * One role: what it is called, who holds it, what it can actually do, and —
 * only on a workspace's own roles — the two controls that change it.
 *
 * THE CARD SHOWS THE GRANT NOW, not just a count. `3/12 actions` told a reader
 * a role was narrow without telling them which three, so answering "what is
 * Reviewer for?" meant reading a twelve-row table sideways. A line of area
 * chips answers it on the card, and the matrix stays the precise version.
 *
 * TIER IS ON THE CARD for the same reason: a custom role sits on MEMBER or
 * ADMIN and that decides everything the permission grid does not — which
 * ladder checks it passes, whether `roleAtLeast(role, ADMIN)` lets it through.
 * A card that showed only the ticked boxes would be describing half the role.
 *
 * The built-in cards carry the heavier border and no controls, because they
 * are a record of what the application code means rather than rows to edit.
 */
const ICON_BUTTON =
  "inline-flex size-6 shrink-0 items-center justify-center rounded-xs text-text-subtle transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text";

const TIER_CHIP = "rounded-xs px-1.5 py-0.5 text-2xs font-medium";

/* Complete class strings, never interpolated — Tailwind scans this file as
   plain text. `-subtle` fills take neutral ink per DESIGN-SYSTEM.md. */
const TIER_TONE: Record<string, string> = {
  OWNER: "bg-brand-subtle text-text-muted",
  ADMIN: "bg-info-subtle text-text-muted",
  MEMBER: "bg-surface-sunken text-text-subtle",
};

export function RoleCard({
  role,
  groups,
  memberCount,
  actionCount,
  canManage,
  onEdit,
  onDelete,
}: {
  role: RoleDefinition;
  /** The catalog, so the chips can name an area rather than repeat ids. */
  groups: PermissionGroup[];
  memberCount: number;
  actionCount: number;
  /** Whether the viewer holds `roles.manage`. Built-ins are locked regardless. */
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const editable = canManage && !role.builtIn;

  return (
    <Card
      className={cn(
        /* `w-full` is load-bearing: `Card` is `flex flex-col`, and as a flex
           ITEM inside the list's `<li className="flex">` it sizes to its
           content rather than to the grid column. Without it the cards sat
           narrow in wide columns and the row read as three islands with
           gutters between them. */
        "h-full w-full gap-2 p-3",
        role.builtIn ? "border-border-strong" : "border-border",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-text">{role.name}</h3>

          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs text-text-subtle">
            {/* `tabular-nums` so the counters do not twitch as roles are reassigned. */}
            <span className="tabular-nums">
              {plural(memberCount, "member", "members")}
            </span>
            <span aria-hidden="true">&middot;</span>
            <span className="tabular-nums">
              {role.permissions.length}/{actionCount} actions
            </span>
          </p>
        </div>

        <span className={cn(TIER_CHIP, TIER_TONE[role.baseRole] ?? TIER_TONE.MEMBER)}>
          {/* The word, not the fill alone — the tiers differ by one hue and
              anyone who cannot separate them still reads the card. */}
          {role.baseRole === "OWNER" ? "Owner tier" : role.baseRole === "ADMIN" ? "Admin tier" : "Member tier"}
        </span>

        {editable && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              aria-label={`Edit ${role.name}`}
              onClick={onEdit}
              className={ICON_BUTTON}
            >
              <PencilIcon className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={`Delete ${role.name}`}
              onClick={onDelete}
              className={ICON_BUTTON}
            >
              <TrashIcon className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      <RolePermissionChips role={role} groups={groups} />
    </Card>
  );
}
