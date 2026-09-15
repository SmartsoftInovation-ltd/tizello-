"use client";

import { useRef, useState } from "react";
import { useMenuPopover } from "@/components/projects/use-menu-popover";
import { CheckIcon, Icon, type IconProps } from "@/components/ui/icons";
import {
  setStoredSurface,
  type ProjectSurface,
  type SurfaceScope,
} from "@/lib/project-surface";
import { cn } from "@/lib/cn";

/**
 * Drawer or modal, chosen in the panel's own header.
 *
 * A **popover** (`showPopover()`), not the app's `DropdownMenu`: this opens
 * inside the panel's `<dialog>`, and `DropdownMenuContent` portals to
 * `document.body`, which renders BEHIND a modal dialog's backdrop.
 * `use-menu-popover.ts` documents the finding, and every other menu inside
 * these drawers already takes the same route.
 *
 * The switch applies immediately and to the panel that is already open —
 * `ui/drawer.tsx` swaps a class on the same `<dialog>` rather than mounting a
 * different component, so the form underneath keeps every character that has
 * been typed into it.
 */
const PANEL_HEIGHT = 108;

const OPTIONS: { value: ProjectSurface; label: string; hint: string }[] = [
  { value: "drawer", label: "Side panel", hint: "Keeps the list in view" },
  { value: "modal", label: "Centred", hint: "The form, and nothing else" },
];

export function SurfaceMenu({
  surface,
  scope = "default",
}: {
  surface: ProjectSurface;
  /** Which preference this switch writes — sprint planning keeps its own. */
  scope?: SurfaceScope;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const position = useMenuPopover({
    open,
    triggerRef,
    panelRef,
    height: PANEL_HEIGHT,
    onDismiss: () => {
      setOpen(false);
      triggerRef.current?.focus();
    },
  });

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Change how this form opens"
        onClick={() => setOpen((value) => !value)}
        className="grid size-7 shrink-0 place-items-center rounded-sm bg-surface-hover text-text-muted transition-colors duration-100 ease-standard hover:bg-surface-sunken hover:text-text"
      >
        {surface === "modal" ? (
          <CentredIcon className="size-4" />
        ) : (
          <SidePanelIcon className="size-4" />
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          popover="manual"
          role="menu"
          aria-label="How this form opens"
          /* The UA stylesheet gives popovers `position: fixed; inset: 0;
             margin: auto; border; padding; background` — stripped so the
             panel's own chrome is the only chrome. */
          /* 272px, matching the width `use-menu-popover.ts` clamps against.
             A narrower panel is placed as though it were 272 wide, so near the
             viewport's right edge — where this trigger lives — it would drift
             left of its trigger by the difference. */
          className="menu-enter fixed inset-auto m-0 w-68 rounded-md border border-border bg-surface p-1 shadow-overlay"
          style={{ top: position.top, left: position.left }}
        >
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === surface}
              onClick={() => {
                setStoredSurface(option.value, scope);
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className={cn(
                "flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left transition-colors duration-100 ease-standard hover:bg-surface-hover",
                option.value === surface ? "text-text" : "text-text-muted",
              )}
            >
              <span className="mt-0.5 shrink-0">
                {option.value === "modal" ? <CentredIcon /> : <SidePanelIcon />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium">{option.label}</span>
                <span className="block text-2xs text-text-subtle">{option.hint}</span>
              </span>
              {option.value === surface && (
                <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-text-brand" />
              )}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** A page with a filled rail down its right edge — the drawer, drawn as what it is. */
function SidePanelIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.75" y="3" width="12.5" height="10" rx="1.5" />
      <path d="M9.5 3v10" />
      <path d="M11 6h2M11 8h2M11 10h2" />
    </Icon>
  );
}

/** A smaller pane floating over a page — the centred modal. */
function CentredIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.75" y="3" width="12.5" height="10" rx="1.5" />
      <rect x="4.5" y="5.75" width="7" height="4.5" rx="1" />
    </Icon>
  );
}
