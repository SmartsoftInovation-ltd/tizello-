"use client";

import { useEffect } from "react";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { useChatSocket } from "@/components/chat/use-chat-socket";
import { Drawer } from "@/components/ui/drawer";
import { markChannelReadAction } from "@/lib/actions/chat-actions";
import type { ChatSender, ChatTarget } from "@/types/chat";

/*
 * The slide-over channel: the project's conversation over whatever screen the
 * reader is on.
 *
 * A DRAWER, NOT A ROUTE, which is the trade this shape makes: you can read the
 * board and the channel at once, and you cannot link somebody to a channel.
 * `ui/drawer.tsx` is a native `<dialog>`, so focus trapping, Esc and the top
 * layer come for free.
 *
 * ONE PANEL, BOTH KINDS OF CHANNEL. It takes a `ChatTarget` — the workspace
 * or the project — and nothing below here knows which it has; the server owns
 * the difference in who may read and write. That is why the workspace channel
 * cost a launcher and a nav row rather than a second panel.
 *
 * THE SOCKET LIVES AND DIES WITH THE PANEL. `useChatSocket` is called from
 * here, which is only mounted while `open`, so a closed panel holds no
 * connection — see `ChatLauncher`, which is what unmounts it.
 *
 * MARKING READ HAPPENS ON OPEN, not on scroll. The watermark only ever moves
 * forward server-side, so the worst case of firing it early is a channel that
 * reads as caught up while a message arrives a second later — and that message
 * is on screen, which is the thing an unread badge is for.
 */

export function ChatPanel({
  target,
  title,
  viewer,
  canModerate,
  open,
  onOpenChange,
}: {
  target: ChatTarget;
  /** The workspace's or project's name — whose conversation this is. */
  title: string;
  viewer: ChatSender | null;
  /** Draws the delete control on other people's messages; the API re-checks. */
  canModerate: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const chat = useChatSocket(target, viewer);
  const targetKey = JSON.stringify(target);

  useEffect(() => {
    void markChannelReadAction(JSON.parse(targetKey));
  }, [targetKey, chat.messages.length]);

  const typists = chat.typing.filter((who) => who.id !== viewer?.id);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} aria-label={`${title} chat`}>
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-text">{title}</h2>
          <p className="text-2xs text-text-subtle">
            {chat.presence.length === 1
              ? "Only you here"
              : `${chat.presence.length} people here`}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close chat"
          className="rounded-sm px-2 py-1 text-sm text-text-subtle transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
          onClick={() => onOpenChange(false)}
        >
          ✕
        </button>
      </header>

      {chat.error && (
        <p
          role="status"
          className="flex items-center justify-between gap-3 bg-danger-subtle px-4 py-2 text-2xs text-text-muted"
        >
          {/* The server's own sentence is deliberately not rendered — the code
              is what the UI branches on, exactly as the REST half does. */}
          <span>
            {chat.error.code === "RATE_LIMITED"
              ? "You are sending messages too quickly."
              : chat.error.code === "VALIDATION_ERROR"
                ? "That message could not be sent."
                : "You cannot do that in this channel."}
          </span>
          <button type="button" onClick={chat.dismissError} className="underline">
            Dismiss
          </button>
        </p>
      )}

      <ChatMessageList
        messages={chat.messages}
        viewerId={viewer?.id ?? null}
        canDelete={canModerate}
        hasOlder={chat.hasOlder}
        ready={chat.ready}
        onEdit={chat.edit}
        onDelete={chat.remove}
        onLoadOlder={chat.loadOlder}
      />

      <p className="h-4 px-4 text-2xs text-text-subtle" aria-live="polite">
        {typists.length === 1
          ? `${typists[0].name ?? "Someone"} is typing…`
          : typists.length > 1
            ? `${typists.length} people are typing…`
            : ""}
      </p>

      <ChatComposer onSend={chat.send} onTyping={chat.signalTyping} />
    </Drawer>
  );
}
