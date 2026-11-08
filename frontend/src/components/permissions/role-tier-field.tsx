"use client";

import { ShieldIcon } from "@/components/ui/app-icons";
import type { IconProps } from "@/components/ui/icons";
import { PersonIcon } from "@/components/ui/nav-icons";
import { cn } from "@/lib/cn";
import type { RoleTier } from "@/types/permissions";

/*
 * Which rung a role sits on: Member or Admin. A radiogroup of two cards, not a
 * select — there are two choices and each needs a line of explanation, which a
 * dropdown cannot carry.
 *
 * Presented as "Access level" with plain-language hints. The mechanism is the
 * tier ladder (`roleAtLeast`), but a person defining a role needs to know what
 * it changes, not what it is called in the code.
 *
 * OWNER IS NOT OFFERED, and that is a security line rather than a design one.
 * `roleAtLeast(role, OWNER)` gates ownership transfer and workspace deletion, so
 * a workspace able to mint a role on that rung could mint one for anybody. The
 * API's validator omits it from its list for the same reason — this control is
 * the convenience, that is the control.
 */
const OPTION =
  "flex h-9 flex-1 items-center gap-2 rounded-sm border px-2.5 text-left transition-colors duration-100 ease-standard";
const SELECTED = "border-brand-500 bg-brand-subtle";
const IDLE = "border-border bg-surface hover:bg-surface-hover";

const TIERS: readonly {
  value: RoleTier;
  label: string;
  hint: string;
  Glyph: (props: IconProps) => React.ReactNode;
}[] = [
  { value: "MEMBER", label: "Member", hint: "Standard access for most roles.", Glyph: PersonIcon },
  { value: "ADMIN", label: "Admin", hint: "Elevated access to run the workspace.", Glyph: ShieldIcon },
];

export function RoleTierField({
  value,
  onChange,
}: {
  value: RoleTier;
  onChange: (tier: RoleTier) => void;
}) {
  const hint = TIERS.find((tier) => tier.value === value)?.hint;

  return (
    <fieldset>
      {/* Same label style and gap as `TextField`, and every option is `h-9` —
          the input's height — so the name field and this row line up. The
          selected tier's explanation sits underneath, where a field's helper
          text goes, instead of making the options taller. */}
      <legend className="text-xs font-semibold text-text-muted">Access level</legend>

      <div className="mt-1 flex gap-2" role="radiogroup" aria-label="Access level" aria-describedby="role-tier-hint">
        {TIERS.map(({ value: tier, label, Glyph }) => {
          const selected = value === tier;

          return (
            <button
              key={tier}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(tier)}
              className={cn(OPTION, selected ? SELECTED : IDLE)}
            >
              <Glyph className={cn("size-4 shrink-0", selected ? "text-text-brand" : "text-text-subtle")} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{label}</span>
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-full border",
                  selected ? "border-brand-500" : "border-border-strong",
                )}
              >
                {selected && <span className="size-2 rounded-full bg-brand-500" />}
              </span>
            </button>
          );
        })}
      </div>
      <p id="role-tier-hint" className="mt-1 text-xs text-text-subtle">
        {hint}
      </p>
    </fieldset>
  );
}
