"use client";

import { cn } from "@/lib/cn";
import { STORY_POINT_CHOICES } from "@/types/project-sprint";

/**
 * The estimate as buttons — 1, 2, 3, 5, 8, 13 — plus a way back to "not
 * estimated".
 *
 * FIBONACCI, AND BUTTONS RATHER THAN A NUMBER FIELD. The point of the ladder is
 * that the gaps widen as confidence drops: nobody can honestly tell a 6 from a
 * 7, but a 5 from an 8 is a real conversation. A free number field invites
 * false precision, and one click is faster than typing during planning.
 *
 * A value OFF the ladder (the API accepts 0–100, and older tasks may carry a
 * 20) is shown as its own selected button rather than silently dropped — the
 * estimate is somebody's, and this control must not hide it.
 *
 * A `radiogroup` with a roving selection, so it is announced as one choice.
 * Buttons carry `type="button"`: this renders inside the drawer's form.
 */
export function StoryPointsChoices({
  value,
  onChange,
  size = "md",
}: {
  /** `null` is "not estimated". */
  value: number | null;
  onChange: (points: number | null) => void;
  size?: "sm" | "md";
}) {
  const offLadder = value !== null && !(STORY_POINT_CHOICES as readonly number[]).includes(value);
  const choices = offLadder ? [...STORY_POINT_CHOICES, value].sort((a, b) => a - b) : STORY_POINT_CHOICES;
  const box = size === "sm" ? "h-7 min-w-7 text-xs" : "h-8 min-w-8 text-sm";

  return (
    <div role="radiogroup" aria-label="Story points" className="flex flex-wrap items-center gap-1">
      {choices.map((points) => {
        const selected = points === value;
        return (
          <button
            key={points}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected ? null : points)}
            className={cn(
              "rounded-sm border px-2 font-semibold tabular-nums transition-colors duration-100 ease-standard",
              box,
              selected
                ? "border-brand-500 bg-brand-500 text-on-brand"
                : "border-border text-text-muted hover:border-border-strong hover:bg-surface-hover hover:text-text",
            )}
          >
            {points}
          </button>
        );
      })}
      {value !== null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded-sm px-2 py-1 text-2xs text-text-subtle transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
        >
          Clear
        </button>
      )}
    </div>
  );
}
