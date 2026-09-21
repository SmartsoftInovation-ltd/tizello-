"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { childHref, currentChildId } from "@/lib/nav-links";
import { setMobileSidebarOpen } from "@/lib/sidebar";
import type { SidebarChildItem } from "@/types/nav";

/*
 * The expanded half of a sidebar group.
 *
 * **It serves two kinds of group, and the difference is what "current" means.**
 * Projects' children are views of one page selected by `?view=`, so the current
 * one is decided by a search param. Planning's are separate routes under one
 * heading, so the current one is decided by the pathname. A child declares
 * which kind it is by setting `param` or `href`; the row rendering is identical
 * either way, which is the point of putting both here rather than writing a
 * near-copy of this file.
 *
 * The param reading is `useSearchParams`, so this is rendered inside a
 * `<Suspense>` by `SidebarTreeItem` — which is what keeps that reading from
 * opting the whole route out of prerendering. A route-style group pays that
 * boundary for nothing, which is a cheaper price than two components.
 *
 * A route-style child with no `href` renders DISABLED rather than as a dead
 * link, the same treatment `SidebarItem` gives an unresolvable item: Planning's
 * children are project-scoped, and from a page with no project in the URL there
 * is nothing to point them at.
 *
 * Still `<a>`s in a `<ul>`, never `role="tab"`: each one navigates.
 *
 * A GUIDE LINE, NOT A BULLET PER ROW. Each child used to carry its own 4px dot,
 * which read as a list of four unrelated things that happened to be indented —
 * the indent was the only thing tying them to the parent, and an indent alone
 * is ambiguous next to a section label. One continuous hairline down the
 * group says "these belong to that" once, for all of them, which is what every
 * file tree does and why they are readable at a glance.
 *
 * IT SITS AT 16px, dead centre of the parent's icon slot
 * (`sidebar-tree-item.tsx` puts that at 8px, 16px wide), so the line drops out
 * of the middle of the glyph the group is named by rather than floating in the
 * gutter beside it. The labels then start at 32px — the parent's own label
 * position — so the two levels share one text edge.
 *
 * THE RAIL IS DRAWN PER ROW, NOT ONCE ON THE LIST, and that is a paint-order
 * fix rather than a preference. As one `::before` on the `<ul>` it sat BEHIND
 * the rows: each link is positioned (it has to be — it carries its own marker)
 * and comes later in tree order, so any row with a fill — the current one, or
 * merely a hovered one — punched a hole in the line. A segment on each row is
 * painted with that row, above its own background.
 *
 * `-bottom-0.5` IS EXACTLY THE 2px `space-y-0.5` GAP, so consecutive segments
 * meet and read as one continuous line. Not more: overshooting would push the
 * last row's segment past the group and into whatever follows it, which is the
 * one thing a guide line must not do — it would claim a sibling as a child.
 *
 * The current row's segment is the same line, 2px and brand-coloured, centred
 * on the 1px rail by `-translate-x-1/2`. The two are written as COMPLETE class
 * strings rather than a base plus overrides, because `cn` is a plain join (see
 * `lib/cn.ts` — no `tailwind-merge`): `before:w-0.5` after `before:w-px` would
 * be two utilities of equal specificity with stylesheet order picking the
 * winner, which is not something class order can decide.
 */
const LIST = "mt-0.5 space-y-0.5";
const BASE =
  "relative flex w-full items-center rounded-sm py-1 pr-2 pl-8 text-left text-xs transition-colors duration-100 ease-standard";
/* Body ink for idle labels, as in `sidebar-item.tsx` — muted read as faded. */
const IDLE = "text-text hover:bg-surface-sunken";
const ACTIVE = "bg-surface font-semibold text-text ring-1 ring-border";
/* `cursor-default` rather than `not-allowed`: the row is unavailable, not
   forbidden, and the crossed circle reads as a refusal. Same call
   `sidebar-item.tsx` makes. */
const DISABLED = "cursor-default text-text-subtle";

const RAIL =
  "before:absolute before:top-0 before:-bottom-0.5 before:left-4 before:w-px before:bg-border before:content-['']";
const RAIL_CURRENT =
  "before:absolute before:top-0 before:-bottom-0.5 before:left-4 before:w-0.5 before:-translate-x-1/2 before:rounded-full before:bg-brand-500 before:content-['']";

export function SidebarSubNav({
  id,
  labelledBy,
  parentHref,
  items,
  /** False when the parent's page is not the one on screen: nothing is current. */
  onPath,
  /** Matched against a route-style child's own `href`. */
  pathname,
}: {
  id: string;
  labelledBy: string;
  parentHref: string;
  items: readonly SidebarChildItem[];
  onPath: boolean;
  pathname: string;
}) {
  const searchParams = useSearchParams();

  /* Every param-style child selects the same param, so the first one that names
     it names it for all. `current` is what the URL asks for; `known` is whether
     any child claims it — a junk `?view=nonsense` falls back to the default
     child, which is exactly how the page parses it. */
  const paramName = items.find((item) => item.param)?.param?.name;
  const current = paramName ? searchParams.get(paramName) : null;
  const known = items.some((item) => item.param?.value === current);

  /* One group is one kind. Asked per list rather than per child so a group of
     route-style children does not treat the first `href`-less one as "the
     default view" — it has no default; it has a child that is not built yet. */
  const routeStyle = items.some((item) => item.href);

  /* Which route-style child the URL is on. Not `item.href === pathname` inline
     any more: a `tabOnly` child is missing from this list, so its own route has
     to light the child it is a lens on. See `currentChildId`. */
  const currentId = routeStyle ? currentChildId(items, pathname) : undefined;

  return (
    <ul id={id} aria-labelledby={labelledBy} className={LIST}>
      {items.map((item) => {
        const active = routeStyle
          ? item.id === currentId
          : onPath && (item.param ? item.param.value === current : !known);

        const rail = active ? RAIL_CURRENT : RAIL;

        if (routeStyle && !item.href) {
          return (
            <li key={item.id}>
              <span
                aria-disabled="true"
                title={item.hint}
                className={cn(BASE, DISABLED, rail)}
              >
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </span>
            </li>
          );
        }

        return (
          <li key={item.id}>
            <Link
              href={item.href ?? childHref(parentHref, item)}
              aria-current={active ? "page" : undefined}
              onClick={() => setMobileSidebarOpen(false)}
              className={cn(BASE, active ? ACTIVE : IDLE, rail)}
            >
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
