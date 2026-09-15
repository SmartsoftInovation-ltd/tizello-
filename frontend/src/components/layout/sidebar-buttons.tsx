"use client";

import { CloseIcon, MenuIcon, PanelLeftIcon } from "@/components/ui/nav-icons";
import { cn } from "@/lib/cn";
import { setMobileSidebarOpen, setSidebarCollapsed } from "@/lib/sidebar";

/*
 * The shell's four icon-only controls. One file because they are one mechanism
 * — the same two stores, the same 28px square — and splitting them would mean
 * four files of eight lines.
 *
 * `ICON_BUTTON` deliberately sets no `display`: every caller pairs a base
 * `hidden` with a breakpoint variant, and `cn` is a plain join, so a display in
 * the base would leave the stylesheet's order to pick the winner.
 */
const ICON_BUTTON =
  "size-7 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors duration-100 ease-standard hover:bg-surface-sunken hover:text-text";

/**
 * In the sidebar header, above `md`. A TOGGLE now, not a one-way collapse.
 *
 * Collapsing used to hide the column outright, which left no control inside it
 * and put the way back in the content strip — a different place from the one
 * the user just clicked. The rail keeps this button, so out and back are the
 * same target.
 */
export function SidebarCollapseButton({ collapsed }: { collapsed: boolean }) {
  return (
    <button
      type="button"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!collapsed}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      onClick={() => setSidebarCollapsed(!collapsed)}
      className={cn("hidden md:inline-flex", ICON_BUTTON)}
    >
      <PanelLeftIcon
        className={cn(
          "size-4 transition-transform duration-200 ease-standard motion-reduce:transition-none",
          collapsed && "rotate-180",
        )}
      />
    </button>
  );
}

/** The hamburger, below `md`. Opens the off-canvas drawer. */
export function MobileSidebarTrigger() {
  return (
    <button
      type="button"
      aria-label="Open navigation"
      onClick={() => setMobileSidebarOpen(true)}
      className={cn("inline-flex md:hidden", ICON_BUTTON)}
    >
      <MenuIcon className="size-4" />
    </button>
  );
}

/**
 * Sits in the sidebar header opposite the collapse button. The two never
 * appear together: this one is `md:hidden`, and below `md` the sidebar only
 * ever renders inside the drawer.
 */
export function MobileSidebarClose() {
  return (
    <button
      type="button"
      aria-label="Close navigation"
      onClick={() => setMobileSidebarOpen(false)}
      className={cn("inline-flex md:hidden", ICON_BUTTON)}
    >
      <CloseIcon className="size-4" />
    </button>
  );
}
