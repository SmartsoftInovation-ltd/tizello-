"use client";

import { cn } from "@/lib/cn";
import type { RoleDefinition } from "@/types/permissions";

/*
 * Which role the invitee joins with: EVERY role the workspace has — the
 * built-in Admin and Member, and each role it defined itself — as a list of
 * radio rows, each with a line saying what it is.
 *
 * Owner is absent on purpose: ownership is transferred, never invited. The
 * API also refuses a role that grants more than the inviter holds, so a role
 * listed here can still come back 403 for someone with a narrow grant — the
 * server is the control, this is the menu.
 */
const BUILT_IN_HINT: Record<string, string> = {
  ADMIN: "Can invite people, change roles and manage every project.",
  MEMBER: "Can work on projects, but not change who has access.",
};

const hintFor = (role: RoleDefinition) =>
  role.builtIn
    ? BUILT_IN_HINT[role.baseRole] ?? ""
    : `Custom role · ${role.permissions.length} ${role.permissions.length === 1 ? "permission" : "permissions"} · ${
        role.baseRole === "ADMIN" ? "Admin" : "Member"
      } level`;

/** The roles an invitation may carry: everything but Owner, built-ins first. */
export function invitableRoles(roles: RoleDefinition[]): RoleDefinition[] {
  return roles
    .filter((role) => role.baseRole !== "OWNER")
    .sort((a, b) => Number(b.builtIn) - Number(a.builtIn));
}

export function InviteRoleChoice({
  name,
  roles,
  value,
  onChange,
}: {
  /** The radio group's form name. */
  name: string;
  roles: RoleDefinition[];
  /** The selected role's id. */
  value: string;
  onChange: (role: RoleDefinition) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold text-text-muted">Role</legend>

      <div className="mt-1.5 max-h-60 space-y-1.5 overflow-y-auto pr-0.5">
        {roles.map((role) => {
          const checked = role.id === value;
          return (
            <label
              key={role.id}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 transition-colors duration-100 ease-standard",
                checked ? "border-brand-500 bg-brand-subtle" : "border-border hover:bg-surface-hover",
              )}
            >
              <input
                type="radio"
                name={name}
                value={role.id}
                checked={checked}
                onChange={() => onChange(role)}
                className="mt-0.5 size-4 shrink-0 accent-brand-500"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium text-text">
                  {role.name}
                  {!role.builtIn && (
                    <span className="rounded-full bg-chip px-1.5 text-2xs font-semibold text-text-subtle">Custom</span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-text-subtle">{hintFor(role)}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
