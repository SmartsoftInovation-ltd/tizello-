"use client";

import { useSidebarCollapsed } from "@/components/layout/sidebar-collapsed";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import type { Workspace } from "@/types/workspace";

/**
 * The client seam that tells the switcher which shape the sidebar is in.
 *
 * `SidebarWorkspace` fetches on the server and cannot read context; the
 * switcher is a client component but lives in `components/workspace/`, and
 * having it reach into `components/layout/` for the sidebar's context would
 * invert the dependency — a workspace control would stop working anywhere but
 * this sidebar. So the coupling lives HERE, in the layout folder that already
 * owns the context, and the switcher takes a plain `compact` boolean.
 *
 * `workspaces` crosses the boundary as plain serialisable data, which is what
 * keeps the `GET /workspaces` on the server.
 */
export function SidebarWorkspaceSlot({
  workspaces,
  storedWorkspaceId,
}: {
  workspaces: Workspace[];
  storedWorkspaceId?: string;
}) {
  const collapsed = useSidebarCollapsed();

  return (
    <div className={collapsed ? "shrink-0" : "min-w-0 flex-1"}>
      <WorkspaceSwitcher
        workspaces={workspaces}
        storedWorkspaceId={storedWorkspaceId}
        compact={collapsed}
      />
    </div>
  );
}
