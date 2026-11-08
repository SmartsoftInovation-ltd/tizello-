"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon } from "@/components/ui/nav-icons";
import { ChevronRightIcon } from "@/components/ui/table-icons";
import { pageTrail } from "@/lib/page-trail";

/**
 * The content strip's left-hand trail: a Home icon, then the module and page
 * the URL names (`🏠 › Roles & permissions › New role`). Replaces the old
 * single page label, so every screen gets the same way back up.
 *
 * The crumbs come from `lib/page-trail.ts`, which never turns an id into a
 * crumb and never links to a segment with no page. The last crumb is the
 * current page — plain text with `aria-current`, not a link to itself.
 */
const LINK =
  "min-w-0 truncate rounded-xs text-text-subtle transition-colors duration-100 ease-standard hover:text-text";

export function StripBreadcrumb() {
  const crumbs = pageTrail(usePathname());

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        <li className="flex shrink-0 items-center">
          <Link
            href="/workspaces"
            aria-current={crumbs.length === 0 ? "page" : undefined}
            className={
              crumbs.length === 0
                ? "-m-1 inline-flex items-center gap-1.5 rounded-xs p-1 font-medium text-text"
                : "-m-1 inline-flex items-center gap-1.5 rounded-xs p-1 text-text-subtle transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
            }
          >
            <HomeIcon className="size-4" />
            Home
          </Link>
        </li>

        {crumbs.map((crumb, index) => {
          const current = index === crumbs.length - 1;

          return (
            <li key={crumb.href} className="flex min-w-0 items-center gap-1.5">
              <ChevronRightIcon aria-hidden className="size-3.5 shrink-0 text-text-subtle" />
              {current ? (
                <span aria-current="page" className="min-w-0 truncate font-medium text-text">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className={LINK}>
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
