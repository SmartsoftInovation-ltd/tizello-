"use client";

import Link from "next/link";
import { Suspense, useId, useState } from "react";
import { SIDEBAR_ICON } from "@/components/layout/sidebar-icons";
import { SidebarSubNav } from "@/components/layout/sidebar-sub-nav";
import { ChevronDownIcon, MoreIcon, PlusIcon } from "@/components/ui/icons";
import { LockedControl } from "@/components/ui/locked-control";
import { cn } from "@/lib/cn";
import { setMobileSidebarOpen } from "@/lib/sidebar";
import type { SidebarItem as SidebarItemData } from "@/types/nav";

/*
 * A nav item that carries sub-views: a disclosure over the same `?view=` links
 * the page's view strip offers, plus the row actions the group would own.
 *
 * The row is a flex container, NOT a link with buttons inside it — a button
 * nested in an anchor is invalid, and the three controls here (toggle, link,
 * two locked actions) are four separate targets. The fill therefore sits on the
 * container and the link stays transparent, which is the only difference from
 * `SidebarItem`'s treatment.
 *
 * `aria-current` moves: while the group is open the current CHILD carries it,
 * so the row is styled active without claiming to be the page. Collapsed, the
 * row takes it back — it is then the only thing on screen naming the page.
 *
 * THE FILL MOVES WITH IT, for a group whose children are routes. Projects'
 * children live under the parent's own path, so parent and child being lit
 * together reads correctly — one page, one section of it. Planning's do not:
 * `Current sprint` IS `/board/sprint`, so lighting the parent as well drew two
 * highlighted rows for one page and made the group look like it had two current
 * items. When a child claims the path, the parent steps back to its idle
 * treatment and the child alone carries the state.
 *
 * THE ICON SLOT IS THE TOGGLE, and that is the fix for a row that did not line
 * up with its own siblings. The chevron used to sit in front of the icon, which
 * pushed this item's glyph to 32px while every plain `SidebarItem` beside it
 * kept its own at 8px — one row in the list visibly indented for no reason a
 * reader could see. Giving the chevron its own gutter would have meant
 * indenting all six siblings to match, for the sake of the one item that has
 * children.
 *
 * So the two glyphs share ONE 16px slot at 8px, exactly where a sibling's icon
 * is: the icon at rest, the chevron once the row is hovered or holds focus.
 * That is Notion's page-tree behaviour and it costs nothing — the expanded
 * children are what say the group is open, so the chevron does not have to be
 * on screen to report it.
 *
 * A 16px BUTTON IS TOO SMALL A TARGET, so `before:-inset-1.5` grows the hit
 * area to 28px without moving the glyph. The alternative — a `size-7` button —
 * would push the icon back off the 8px line this whole change is about.
 *
 * THE TWO ROW ACTIONS ARE HOVER-REVEALED for the same reason Notion hides
 * them: a `+` and a `⋯` on every row is four permanent glyphs of chrome in a
 * 256px column, and they are the least likely thing in it to be wanted.
 * `group-focus-within` is what keeps them reachable from the keyboard.
 *
 * They are also OPT-IN, via `rowActions`. They were written for Projects, where
 * "new project" and "project actions" are real operations the group owns.
 * Planning owns nothing: its children are three fixed screens of one sprint
 * workflow, and a `+` there would promise a "new backlog" that is not a thing.
 * A disclosure is a shape, not a licence to create.
 */
const ROW =
  "group/row flex w-full items-center gap-2 rounded-sm pr-1 pl-2 transition-colors duration-100 ease-standard";
/* Body ink for the label and a hairline ring when current — see `sidebar-item.tsx`. */
const ROW_IDLE = "text-text hover:bg-surface-sunken";
const ROW_ACTIVE = "bg-surface ring-1 ring-border";
const LINK = "flex min-w-0 flex-1 items-center py-1.5 text-left text-sm";
const ICON_BUTTON =
  "size-6 rounded-sm text-text-muted hover:bg-surface-sunken hover:text-text";

/* The shared 16px slot. `grid place-items-center` stacks the icon and the
   chevron on one another so neither is in the other's flow, and the fade is on
   opacity alone — a swap that moved anything would shift the label beside it. */
const SLOT =
  "relative grid size-4 shrink-0 place-items-center rounded-xs text-current before:absolute before:-inset-1.5 before:content-['']";
const SWAP = "transition-opacity duration-100 ease-standard";
const AT_REST = "group-hover/row:opacity-0 group-focus-within/row:opacity-0";
const ON_HOVER =
  "absolute opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100";
/* Revealed with the row. Not `hidden` — a control that is not in the layout
   until hover makes the row's contents jump as the pointer arrives. */
const ROW_ACTION = "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100";

/* Same row geometry as the real list — py-1 on 16px text is 24px — so the
   boundary resolving does not shift the nav under the cursor. */
function SubNavFallback({ count }: { count: number }) {
  return (
    <ul aria-hidden="true" className="mt-0.5 space-y-0.5">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="h-6" />
      ))}
    </ul>
  );
}

export function SidebarTreeItem({
  item,
  href,
  active,
  pathname,
  rowActions = false,
  defaultOpen = false,
}: {
  item: SidebarItemData;
  /** Resolved by the caller; a group is only rendered when it has one. */
  href: string;
  active: boolean;
  /** Handed to the children, which may match it against their own routes. */
  pathname: string;
  /** Draws the hover-revealed `+` and `⋯`. Only Projects has operations behind them. */
  rowActions?: boolean;
  /** Start expanded on every page, not only when this group holds the current one. */
  defaultOpen?: boolean;
}) {
  const Icon = SIDEBAR_ICON[item.icon];
  const children = item.children ?? [];
  /* Open on arrival when this is the page being viewed — or, for a group whose
     children are routes of their own, when one of THEM is. Projects' children
     share the parent's path so `active` already covers them; Planning's do not,
     and a collapsed group would hide the very row naming the current page.

     A plain `useState` after that: the sidebar stays mounted across client
     navigations, so a group the user collapsed stays collapsed while they move
     around. */
  /* True when one of the children IS the current page — only possible for a
     route-style group, since a param-style child shares the parent's path. */
  const childIsCurrent = children.some((child) => child.href === pathname);

  const [open, setOpen] = useState(defaultOpen || active || childIsCurrent);

  /* The row is lit only when nothing below it is. See the header. */
  const rowActive = active && !childIsCurrent;

  /* Not derived from `item.id` — the desktop <aside> and the mobile drawer
     render this same tree at once, and a static id would appear twice. */
  const listId = useId();
  const labelId = useId();

  return (
    <li>
      <div className={cn(ROW, rowActive ? ROW_ACTIVE : ROW_IDLE)}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-label={`${open ? "Collapse" : "Expand"} ${item.label}`}
          onClick={() => setOpen(!open)}
          className={SLOT}
        >
          <Icon className={cn("size-4 text-text-muted", SWAP, AT_REST)} />
          <ChevronDownIcon
            aria-hidden="true"
            className={cn("size-3.5", SWAP, ON_HOVER, !open && "-rotate-90")}
          />
        </button>

        <Link
          id={labelId}
          href={href}
          aria-current={active && !open ? "page" : undefined}
          /* Below `md` this row lives in the drawer, which has to close behind
             the navigation it just started. */
          onClick={() => setMobileSidebarOpen(false)}
          className={cn(LINK, rowActive && "font-semibold text-text")}
        >
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        </Link>

        {rowActions && (
          <>
            <LockedControl
              reason="Creating a project from the sidebar is not built yet"
              label={`New project in ${item.label}`}
              className={cn(ICON_BUTTON, ROW_ACTION)}
            >
              <PlusIcon className="size-3.5" />
            </LockedControl>

            <LockedControl
              reason="These actions are not built yet"
              label={`${item.label} actions`}
              className={cn(ICON_BUTTON, ROW_ACTION)}
            >
              <MoreIcon className="size-3.5" />
            </LockedControl>
          </>
        )}
      </div>

      {open && children.length > 0 ? (
        /* `SidebarSubNav` reads `useSearchParams`; the boundary is what stops
           that reading from opting the whole route out of prerendering. */
        <Suspense fallback={<SubNavFallback count={children.length} />}>
          <SidebarSubNav
            id={listId}
            labelledBy={labelId}
            parentHref={href}
            items={children}
            onPath={active}
            pathname={pathname}
          />
        </Suspense>
      ) : null}
    </li>
  );
}
