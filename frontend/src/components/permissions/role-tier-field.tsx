"use client";

import { cn } from "@/lib/cn";
import type { RoleTier } from "@/types/permissions";

/*
 * Which rung a role sits on: Member or Admin. A radiogroup, not a select —
 * there are two choices and each needs a line of explanation, which a dropdown
 * cannot carry.
 *
 * OWNER IS NOT OFFERED, and that is a security line rather than a design one.
 * `roleAtLeast(role, OWNER)` gates ownership transfer and workspace deletion, so
 * a workspace able to mint a role on that rung could mint one for anybody. The
 * API's validator omits it from its list for the same reason — this control is
 * the convenience, that is the control.
 */
const OPTION =
  "flex-1 rounded-sm border px-3 py-2 text-left transition-colors duration-100 ease-standard";
const SELECTED = "border-brand-500 bg-brand-subtle";
const IDLE = "border-border bg-surface hover:bg-surface-hover";

const TIERS: readonly { value: RoleTier; label: string; hint: string }[] = [
  { value: "MEMBER", label: "Member tier", hint: "Does the work. The default." },
  { value: "ADMIN", label: "Admin tier", hint: "Passes admin-level checks." },
];

export function RoleTierField({
  value,
  onChange,
}: {
  value: RoleTier;
  onChange: (tier: RoleTier) => void;
}) {
  return (
    <fieldset>
      <legend className="text-2xs font-semibold tracking-widest text-text-subtle uppercase">
        Tier
      </legend>
      <p className="mt-1 text-2xs text-text-subtle">
        Permissions below say what the role may do. The tier decides the
        ladder checks they are not part of.
      </p>

      <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Tier">
        {TIERS.map((tier) => (
          <button
            key={tier.value}
            type="button"
            role="radio"
            aria-checked={value === tier.value}
            onClick={() => onChange(tier.value)}
            className={cn(OPTION, value === tier.value ? SELECTED : IDLE)}
          >
            <span className="block text-xs font-medium text-text">{tier.label}</span>
            <span className="mt-0.5 block text-2xs text-text-subtle">{tier.hint}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
