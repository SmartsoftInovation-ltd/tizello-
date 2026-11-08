"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon } from "@/components/ui/nav-icons";
import { ChevronRightIcon } from "@/components/ui/table-icons";
import { pageTitleFor } from "@/lib/page-title";

/*
 * A page trail rendered in the CONTENT column, for the one page that uses it
 * as its heading (`/workspaces`). Every other page's trail is the content
 * strip's (`strip-breadcrumb.tsx`); a second one in the column would be the
 * same route drawn twice.
 *
 * Two crumbs, never a full segment-by-segment trail. The middle segments of
 * these routes are ids (`/workspaces/cmtr4i04q…/members`), and humanising a
 * cuid produces a crumb that is both unreadable and unclickable-looking. The
 * ancestors that matter are already one click away in the sidebar.
 *
 * Home is icon-only: it points at `/workspaces` (the same href the sidebar's
 * Home item uses), so a "Home / Workspaces" pair of words would be one route
 * written twice.
 */

/**
 * `heading` makes the current crumb the page's `<h1>` rather than a `<span>`.
 * The workspaces page renders the trail where its title used to be, and a page
 * whose only visible name is a `<span>` is a page with no heading at all — so
 * the crumb becomes the heading instead of sitting next to a second one.
 *
 * `label` overrides the name derived from the path, for the one case the URL
 * cannot express: `?archived=1` is a different screen with the same pathname.
 *
 * `trail` adds named, linked crumbs between Home and the current page, for a
 * page that lives under a module (`Roles & permissions › Create a role`). The
 * caller names them, so an id segment never becomes a crumb.
 */
const CRUMB_LINK =
  "min-w-0 truncate rounded-xs text-text-subtle transition-colors duration-100 ease-standard hover:text-text";

export function Breadcrumb({
  heading = false,
  label: override,
  trail = [],
}: {
  heading?: boolean;
  label?: string;
  trail?: readonly { label: string; href: string }[];
} = {}) {
  const pathname = usePathname();
  const label = override ?? pageTitleFor(pathname);
  const Current = heading ? "h1" : "span";

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex min-w-0 items-center gap-1.5 text-xs leading-5">
        <li className="flex shrink-0 items-center">
          <Link
            href="/workspaces"
            aria-label="Home"
            /* `-m-1 p-1` — the padding is hit area only. Left as plain
               padding it would indent the glyph 4px past the page's own left
               margin, which is exactly the misalignment this row is meant to
               sit on. */
            className="-m-1 inline-flex items-center rounded-xs p-1 text-text-subtle transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
          >
            <HomeIcon className="size-4" />
          </Link>
        </li>

        {trail.map((crumb) => (
          <li key={crumb.href} className="flex min-w-0 items-center gap-1.5">
            <ChevronRightIcon aria-hidden className="size-3.5 shrink-0 text-text-subtle" />
            <Link href={crumb.href} className={CRUMB_LINK}>
              {crumb.label}
            </Link>
          </li>
        ))}

        <li className="flex min-w-0 items-center gap-1.5">
          <ChevronRightIcon aria-hidden className="size-3.5 shrink-0 text-text-subtle" />
          <Current
            aria-current="page"
            className={
              heading
                ? "min-w-0 truncate text-base leading-5 font-semibold tracking-tight text-text"
                : "min-w-0 truncate font-medium text-text"
            }
          >
            {label}
          </Current>
        </li>
      </ol>
    </nav>
  );
}
