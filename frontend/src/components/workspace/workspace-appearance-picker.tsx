"use client";

import { useRef } from "react";
import { CheckIcon } from "@/components/ui/icons";
import { WorkspaceImageField } from "@/components/workspace/workspace-image-field";
import { EmojiPickerPopover } from "@/components/workspace/emoji-picker-popover";
import { ShuffleIcon } from "@/components/workspace/workspace-appearance-icons";
import {
  COLOR_CHOICES,
  ICON_CHOICES,
  isCustomColor,
  randomIcon,
} from "@/components/workspace/appearance-choices";

/**
 * The icon + colour choosers for `CreateWorkspaceDialog`, split out only to
 * clear the 150-line cap — both are pure controlled inputs with no state of
 * their own. Clicking the already-selected option clears it, which is the
 * only way to get back to "no icon" / "no colour" once one is picked.
 */
export function WorkspaceAppearancePicker({
  icon,
  imageUrl,
  color,
  onIconChange,
  onImageChange,
  onColorChange,
}: {
  icon: string;
  /** The uploaded picture's path, or "" for none. It wins over the icon. */
  imageUrl: string;
  color: string;
  onIconChange: (icon: string) => void;
  onImageChange: (imageUrl: string) => void;
  onColorChange: (color: string) => void;
}) {
  const custom = isCustomColor(color);
  const colorInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <WorkspaceImageField imageUrl={imageUrl} onChange={onImageChange} />

      <fieldset className="mt-5">
        <legend className="text-xs font-semibold text-text-muted">Icon</legend>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {ICON_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={icon === choice}
              onClick={() => onIconChange(icon === choice ? "" : choice)}
              className={[
                "flex size-8 items-center justify-center rounded-sm border text-base transition-colors duration-100 ease-standard",
                icon === choice
                  ? "border-focus bg-surface-hover ring-2 ring-focus"
                  : "border-border hover:bg-surface-hover",
              ].join(" ")}
            >
              {choice}
            </button>
          ))}

          <span className="mx-0.5 h-6 w-px bg-border" aria-hidden="true" />

          <EmojiPickerPopover onSelect={onIconChange} />

          <button
            type="button"
            aria-label="Pick a random icon"
            onClick={() => onIconChange(randomIcon(icon))}
            className="flex size-8 items-center justify-center rounded-sm border border-border text-text-muted transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
          >
            <ShuffleIcon className="size-4" />
          </button>
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-xs font-semibold text-text-muted">Colour</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {COLOR_CHOICES.map((choice) => (
            <button
              key={choice.hex}
              type="button"
              aria-pressed={color === choice.hex}
              aria-label={choice.name}
              onClick={() => onColorChange(color === choice.hex ? "" : choice.hex)}
              className="flex size-7 items-center justify-center rounded-full text-on-brand transition-transform duration-100 ease-standard hover:scale-110"
              style={{ backgroundColor: choice.hex }}
            >
              {color === choice.hex && <CheckIcon className="size-3.5" />}
            </button>
          ))}

          {/*
           * The one swatch whose fill isn't a design token on purpose: a
           * conic rainbow is the standard "pick any colour" affordance, and
           * once a custom colour is chosen the swatch shows that literal hex
           * back — same "decorative, not semantic" exception `COLOR_CHOICES`
           * already carries. The native `<input type="color">` is layered on
           * top at `opacity-0` rather than hidden, so it stays a real hit
           * target for the OS colour picker (a browser built-in — no new
           * dependency, and it closes itself once a colour is picked).
           */}
          <button
            type="button"
            aria-pressed={custom}
            aria-label="Choose a custom colour"
            onClick={() => colorInputRef.current?.click()}
            className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-on-brand transition-transform duration-100 ease-standard hover:scale-110"
            style={{
              background: custom
                ? color
                : "conic-gradient(from 180deg, #f87168, #f5cd47, #4bce97, #579dff, #9f8fef, #f87168)",
            }}
          >
            {custom && <CheckIcon className="size-3.5" />}
            <input
              ref={colorInputRef}
              type="color"
              value={custom ? color : "#34c77b"}
              onChange={(event) => onColorChange(event.target.value)}
              aria-hidden="true"
              tabIndex={-1}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </button>
        </div>
      </fieldset>
    </>
  );
}
