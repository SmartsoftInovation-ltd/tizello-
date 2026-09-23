"use client";

import { useEffect, useState } from "react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { useSidebarCollapsed } from "@/components/layout/sidebar-collapsed";
import { SIDEBAR_ICON } from "@/components/layout/sidebar-icons";
import { useActiveWorkspaceId } from "@/components/workspace/use-active-workspace-id";
import {
  loadChatViewerAction,
  loadUnreadCountAction,
} from "@/lib/actions/chat-actions";
import { cn } from "@/lib/cn";
import { setMobileSidebarOpen } from "@/lib/sidebar";
import type { ChatSender } from "@/types/chat";
import type { SidebarItem as SidebarItemData } from "@/types/nav";

/**
 * The workspace channel's row in the sidebar — one conversation for everyone in
 * the workspace, which is what makes it belong here rather than on a project
 * screen.
 *
 * ITS OWN COMPONENT, exactly as `SearchSidebarItem` is and for the reason that
 * file gives: `SidebarItem` has two shapes, a `<Link>` and a disabled
 * `<button>`, and a third mode for "a button that opens a panel" would put a
 * branch in every nav row to serve one of them. The class strings are copied so
 * the row is pixel-identical to its neighbours.
 *
 * IT READS THE WORKSPACE FROM THE SIDEBAR'S OWN STATE (`useActiveWorkspaceId`),
 * not from the route, so the channel follows the switcher — including on
 * `/board/*` and `/my-tasks`, which carry no workspace in their path.
 *
 * THE VIEWER AND THE UNREAD COUNT COME FROM SERVER ACTIONS, because the nav is
 * a client tree fed by plain serialisable data and there is no server parent
 * here to fetch them. The identity is deliberately NOT taken from anything the
 * client already holds: it decides which messages the reader may edit.
 *
 * Disabled with a hint until a workspace is chosen — a channel needs one to
 * belong to.
 */

const BASE =
  "flex w-full items-center rounded-sm py-1.5 text-left text-sm transition-colors duration-100 ease-standard";
const ROW_EXPANDED = "gap-2 px-2";
const ROW_COLLAPSED = "justify-center px-0";
const IDLE = "text-text hover:bg-surface-sunken";
const DISABLED = "cursor-not-allowed text-text-subtle";

export function WorkspaceChatSidebarItem({ item }: { item: SidebarItemData }) {
  const collapsed = useSidebarCollapsed();
  const workspaceId = useActiveWorkspaceId();
  const Icon = SIDEBAR_ICON[item.icon];

  const [open, setOpen] = useState(false);
  const [viewer, setViewer] = useState<ChatSender | null>(null);
  const [unread, setUnread] = useState(0);

  /* Re-read when the panel closes as well as when the workspace changes: the
     close is the moment the count has just gone to zero, and the sidebar is
     not re-rendered by the panel's revalidation. */
  useEffect(() => {
    if (!workspaceId) return;

    let live = true;

    void loadChatViewerAction().then((who) => live && setViewer(who));
    void loadUnreadCountAction({ workspaceId }).then(
      (count) => live && setUnread(count),
    );

    return () => {
      live = false;
    };
  }, [workspaceId, open]);

  return (
    <li>
      <button
        type="button"
        disabled={!workspaceId}
        onClick={() => {
          /* Below `md` this row lives in the drawer, which has to get out of
             the way of the panel it just opened. */
          setMobileSidebarOpen(false);
          setOpen(true);
        }}
        title={collapsed ? item.label : !workspaceId ? item.hint : undefined}
        aria-label={collapsed ? item.label : undefined}
        aria-haspopup="dialog"
        className={cn(
          BASE,
          collapsed ? ROW_COLLAPSED : ROW_EXPANDED,
          workspaceId ? IDLE : DISABLED,
        )}
      >
        <Icon className="size-4 shrink-0 text-text-muted" />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {unread > 0 && (
              <span className="shrink-0 rounded-xs bg-brand-500 px-1 text-2xs font-semibold text-on-brand">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </>
        )}
      </button>

      {/* Mounted only while open, so a sidebar that is always on screen is not
          always holding a socket. */}
      {open && workspaceId && (
        <ChatPanel
          target={{ workspaceId }}
          title={item.label}
          viewer={viewer}
          /* Deleting somebody else's message is an OWNER/ADMIN power, and the
             API decides it. Drawing the control from a role this tree does not
             have would be a guess; the server refuses regardless, so the
             honest default is to show the reader only their own. */
          canModerate={false}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </li>
  );
}
