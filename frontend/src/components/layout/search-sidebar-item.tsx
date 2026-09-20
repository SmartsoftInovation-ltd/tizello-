"use client";

import { SIDEBAR_ICON } from "@/components/layout/sidebar-icons";
import { useSidebarCollapsed } from "@/components/layout/sidebar-collapsed";
import { cn } from "@/lib/cn";
import { setSearchPaletteOpen } from "@/lib/search-palette";
import { setMobileSidebarOpen } from "@/lib/sidebar";
import type { SidebarItem as SidebarItemData } from "@/types/nav";

/**
 * The sidebar's Search row — the one nav item that opens a panel instead of
 * navigating.
 *
 * ITS OWN COMPONENT RATHER THAN AN `onClick` THREADED THROUGH `SidebarItem`.
 * That component has exactly two shapes, a `<Link>` and a disabled `<button>`,
 * chosen by whether an href exists; a third mode for "a button that does
 * something" would put a branch in every nav row to serve one of them. The row
 * borrows the same class strings so it is pixel-identical to its neighbours.
 *
 * The ⌘K hint is not shown when the rail is collapsed — there is no room, and
 * the shortcut works whether or not it is advertised.
 */
const BASE = "flex w-full items-center rounded-sm py-1.5 text-left text-sm transition-colors duration-100 ease-standard";
const ROW_EXPANDED = "gap-2 px-2";
const ROW_COLLAPSED = "justify-center px-0";
const IDLE = "text-text hover:bg-surface-sunken";

export function SearchSidebarItem({ item }: { item: SidebarItemData }) {
  const collapsed = useSidebarCollapsed();
  const Icon = SIDEBAR_ICON[item.icon];

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          /* Below `md` this row lives in the drawer, which has to get out of
             the way of the panel it just opened. */
          setMobileSidebarOpen(false);
          setSearchPaletteOpen(true);
        }}
        title={collapsed ? item.label : undefined}
        aria-label={collapsed ? item.label : undefined}
        aria-haspopup="dialog"
        className={cn(BASE, collapsed ? ROW_COLLAPSED : ROW_EXPANDED, IDLE)}
      >
        <Icon className="size-4 shrink-0 text-text-muted" />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <kbd className="shrink-0 rounded-xs border border-border bg-surface px-1 font-sans text-2xs text-text-subtle">⌘K</kbd>
          </>
        )}
      </button>
    </li>
  );
}
