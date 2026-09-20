"use client";

import { usePathname } from "next/navigation";
import { SearchSidebarItem } from "@/components/layout/search-sidebar-item";
import { SidebarItem } from "@/components/layout/sidebar-item";
import { SidebarSection } from "@/components/layout/sidebar-section";
import { useActiveWorkspaceId } from "@/components/workspace/use-active-workspace-id";
import { resolveHref } from "@/lib/nav-links";
import type {
  SidebarItem as SidebarItemData,
  SidebarSection as SidebarSectionData,
} from "@/types/nav";

/**
 * The nav list. A client leaf for one reason — the active item is derived from
 * `usePathname` — so the link data arrives as plain serialisable props from a
 * Server Component parent rather than being fetched or built here.
 *
 * This is the sidebar's scroll region: the switcher above it and the account
 * row below it are pinned, and only this list moves when the nav outgrows the
 * viewport.
 */
export function SidebarNav({
  primary,
  sections,
}: {
  primary: readonly SidebarItemData[];
  sections: readonly SidebarSectionData[];
}) {
  const pathname = usePathname();
  /* The remembered workspace too, so Projects / Members from `/board/*` open
     the workspace the switcher shows rather than the demo fallback. */
  const workspaceId = useActiveWorkspaceId();

  return (
    <nav
      aria-label="Workspace"
      className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pb-3"
    >
      <ul className="space-y-0.5">
        {primary.map((item) => {
          /* Search opens the ⌘K palette instead of navigating — the one nav
             row that is a button. */
          if (item.id === "search") return <SearchSidebarItem key={item.id} item={item} />;

          const href = resolveHref(item, workspaceId);
          return (
            <SidebarItem
              key={item.id}
              item={item}
              href={href}
              active={href === pathname}
            />
          );
        })}
      </ul>

      {sections.map((section) => (
        <SidebarSection
          key={section.id}
          section={section}
          pathname={pathname}
          workspaceId={workspaceId}
        />
      ))}
    </nav>
  );
}
