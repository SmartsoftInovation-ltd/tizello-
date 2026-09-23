"use client";

import { useState } from "react";
import { ChatPanel } from "@/components/chat/chat-panel";
import type { ChatSender, ChatTarget } from "@/types/chat";

/*
 * The button that opens the channel, and the only thing this feature costs a
 * page that never opens it.
 *
 * IT MOUNTS THE PANEL ONLY WHILE OPEN. `ChatPanel` is what calls
 * `useChatSocket`, so a closed launcher holds no socket, no listeners and no
 * message state — a project screen left open in a background tab is not
 * quietly holding a connection.
 *
 * The unread count comes from the server on render and is NOT live: it is a
 * reason to open the panel, and once the panel is open the messages themselves
 * are the truth. Opening marks the channel read, so the badge clears on the
 * next navigation or revalidation.
 *
 * TWO WAYS IT IS DRAWN. `floating` is the project channel's button, fixed to
 * the bottom-right because it is mounted by the project LAYOUT and has to sit
 * above the board, the backlog and the sprint screens alike, none of which
 * share a header component. `nav` is the workspace channel's row in the
 * sidebar, which looks like the rows around it.
 */

const STYLE = {
  floating:
    "fixed right-5 bottom-5 z-40 flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-text shadow-overlay transition-colors duration-100 ease-standard hover:bg-surface-hover",
  nav: "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-text-muted transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text",
} as const;

export function ChatLauncher({
  target,
  title,
  label,
  viewer,
  canModerate,
  unreadCount,
  appearance = "floating",
  icon,
}: {
  target: ChatTarget;
  /** The channel's own name, shown in the panel header. */
  title: string;
  /** What the button says. "Chat" on a project, the workspace's name in the nav. */
  label: string;
  viewer: ChatSender | null;
  canModerate: boolean;
  unreadCount: number;
  appearance?: keyof typeof STYLE;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          unreadCount > 0 ? `Open ${title} chat, ${unreadCount} unread` : `Open ${title} chat`
        }
        className={STYLE[appearance]}
      >
        {icon}
        <span className="flex-1 truncate text-start">{label}</span>
        {unreadCount > 0 && (
          <span className="inline-flex min-w-5 items-center justify-center rounded-xs bg-brand-500 px-1 text-2xs font-semibold text-on-brand">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <ChatPanel
          target={target}
          title={title}
          viewer={viewer}
          canModerate={canModerate}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
