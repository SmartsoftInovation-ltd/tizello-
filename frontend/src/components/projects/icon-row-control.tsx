"use client";

import {
  ICON_CHOICES,
  randomIcon,
} from "@/components/workspace/appearance-choices";
import { EmojiPickerPopover } from "@/components/workspace/emoji-picker-popover";
import { ShuffleIcon } from "@/components/workspace/workspace-appearance-icons";
import { cn } from "@/lib/cn";

/**
 * The Icon row — the emoji alone, with no colour control anywhere in it.
 *
 * Icon and colour used to share ONE row behind a popover reading "Chosen", on
 * the argument that the full `WorkspaceAppearancePicker` was too tall to
 * inline. That argument was about the picker, not about the two decisions:
 * they are independent (a colour with no icon is a valid swatch, an icon with
 * no colour is a valid glyph), and folding them together meant two clicks and
 * a panel to change either one.
 *
 * So each is its own row now, and each is INLINE rather than behind a popover.
 * Six quick emoji, the full picker and a shuffle fit on one 36px line — the
 * same height as every other value control in the list, which is what the
 * popover was buying in the first place.
 *
 * Clicking the chosen emoji again clears it. That is the only route back to
 * "no icon", and it is the same gesture `WorkspaceAppearancePicker` uses.
 */
const QUICK: readonly string[] = ICON_CHOICES.slice(0, 6);

/* size-8 to match `EmojiPickerPopover`'s own trigger, which sits in this row
   and is not ours to restyle — two button sizes on one line reads as a bug. */
const CHOICE =
  "flex size-8 shrink-0 items-center justify-center rounded-sm border text-base leading-none transition-colors duration-100 ease-standard";
const CHOSEN = "border-focus bg-surface ring-2 ring-focus";

export function IconRowControl({
  icon,
  onChange,
}: {
  icon: string;
  onChange: (icon: string) => void;
}) {
  /* An emoji picked from the full picker is not in the quick row, so without
     this seventh slot the row could not show WHICH icon is set. */
  const offPalette = Boolean(icon) && !QUICK.includes(icon);

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-sm border border-transparent px-1.5 py-1 transition-colors duration-100 ease-standard hover:bg-surface-hover">
      {QUICK.map((choice) => (
        <button
          key={choice}
          type="button"
          aria-pressed={icon === choice}
          aria-label={`Icon ${choice}`}
          onClick={() => onChange(icon === choice ? "" : choice)}
          className={cn(
            CHOICE,
            icon === choice ? CHOSEN : "border-border hover:bg-surface",
          )}
        >
          <span aria-hidden="true">{choice}</span>
        </button>
      ))}

      {offPalette && (
        <button
          type="button"
          aria-pressed={true}
          aria-label={`Clear the icon ${icon}`}
          onClick={() => onChange("")}
          className={cn(CHOICE, CHOSEN)}
        >
          <span aria-hidden="true">{icon}</span>
        </button>
      )}

      <span className="mx-0.5 h-6 w-px shrink-0 bg-border" aria-hidden="true" />

      <EmojiPickerPopover onSelect={onChange} />

      <button
        type="button"
        aria-label="Pick a random icon"
        onClick={() => onChange(randomIcon(icon))}
        className={cn(CHOICE, "border-border text-text-muted hover:bg-surface hover:text-text")}
      >
        <ShuffleIcon className="size-4" />
      </button>

      {!icon && <span className="ml-0.5 text-xs text-text-subtle">No icon yet</span>}
    </div>
  );
}
