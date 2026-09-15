"use client";

import Link from "next/link";
import { SIDEBAR_ICON } from "@/components/layout/sidebar-icons";
import { useSidebarCollapsed } from "@/components/layout/sidebar-collapsed";
import { cn } from "@/lib/cn";
import { setMobileSidebarOpen } from "@/lib/sidebar";
import type { SidebarItem as SidebarItemData } from "@/types/nav";

/*
 * The sidebar sits on `bg-canvas`, where `surface-hover` is invisible in light
 * (both resolve to ink-100). So the two fills step outward from the canvas
 * instead, and both directions work in either theme:
 *
 *   hover  → surface-sunken   (darker in light, lighter in dark)
 *   active → surface          (further again — the whole active treatment,
 *                              plus brighter text; no accent bar)
 *
 * INK, NOT MUTED, FOR LABELS. Idle labels were `text-muted` on the canvas, and
 * disabled ones `text-subtle` at 60% opacity — in light mode the whole column
 * read as faded, and "Soon" rows fell under 2:1. Labels now carry the body ink;
 * the ICON stays muted, which keeps the hierarchy (and the active row, a white
 * card with a hairline ring and bold label, stays the clear standout).
 * Disabled rows drop the opacity: `text-subtle` plus the "Soon" chip already
 * say unavailable, and at full opacity they are still readable. Dark mode shifts
 * only by the small step between `text-muted` and `text` there.
 */
const BASE =
  "flex w-full items-center rounded-sm py-1.5 text-left text-sm transition-colors duration-100 ease-standard";
/* Collapsed, the row is a square with the icon centred. `justify-center` and
   no horizontal padding rather than the same `px-2 gap-2`: at 56px minus the
   nav's own `px-2`, a left-aligned icon sits visibly off-centre. */
const ROW_EXPANDED = "gap-2 px-2";
const ROW_COLLAPSED = "justify-center px-0";
const IDLE = "text-text hover:bg-surface-sunken";
const ACTIVE = "bg-surface font-semibold text-text ring-1 ring-border";
const DISABLED = "cursor-not-allowed text-text-subtle";

export function SidebarItem({
  item,
  href,
  active,
}: {
  item: SidebarItemData;
  /** Resolved by the caller. Absent renders the item disabled. */
  href?: string;
  active: boolean;
}) {
  /* Icons only, when the rail is on. The label survives as `title` and as the
     accessible name — see `sidebar-collapsed.ts`. */
  const collapsed = useSidebarCollapsed();
  const Icon = SIDEBAR_ICON[item.icon];
  const row = cn(BASE, collapsed ? ROW_COLLAPSED : ROW_EXPANDED);

  if (!href) {
    return (
      <li>
        {/* A real disabled control, not a dimmed link: not focusable, not
            navigable, and announced as unavailable. */}
        <button
          type="button"
          disabled
          aria-disabled="true"
          /* Collapsed there is no visible label, so the title carries the name
             as well as the hint — a tooltip reading only "Coming soon" over an
             unlabelled icon says nothing about which feature. */
          title={collapsed ? `${item.label} — ${item.hint ?? "Soon"}` : item.hint}
          aria-label={collapsed ? item.label : undefined}
          className={cn(row, DISABLED)}
        >
          <Icon className="size-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className="shrink-0 rounded-xs border border-border bg-surface px-1 text-2xs text-text-subtle">
                Soon
              </span>
            </>
          )}
        </button>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        aria-label={collapsed ? item.label : undefined}
        /* Below `md` this item lives inside the drawer, which has to close
           behind the navigation it just started. */
        onClick={() => setMobileSidebarOpen(false)}
        className={cn(row, active ? ACTIVE : IDLE)}
      >
        <Icon className={cn("size-4 shrink-0", active ? "text-text" : "text-text-muted")} />
        {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
      </Link>
    </li>
  );
}
