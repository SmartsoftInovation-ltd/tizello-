"use client";

import { useEffect } from "react";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatNotice } from "@/components/chat/chat-notice";
import { ChatThread } from "@/components/chat/chat-thread";
import { useChatSocket } from "@/components/chat/use-chat-socket";
import { markChannelReadAction } from "@/lib/actions/chat-actions";
import type { ChatSender } from "@/types/chat";

/*
 * The workspace channel, whole-screen: header, thread, composer.
 *
 * A PAGE RATHER THAN A PANEL. Chat began as a drawer over the board, which is
 * right for a glance and wrong for the thing people sit in: a drawer has no
 * URL, cannot be a browser tab, and gives a conversation two thirds of the
 * width it wants. The route is `/workspaces/:id/chat`.
 *
 * THE COLUMN IS `h-full` WITH ONE SCROLLING CHILD. The header and the composer
 * are pinned by being siblings of a `flex-1 min-h-0` thread, not by `sticky`:
 * a sticky composer over a scroll container leaves the last message under the
 * bar at the bottom of the scroll, which is exactly where the newest message
 * is. `min-h-0` is load-bearing — without it a flex child refuses to shrink
 * below its content and the whole page scrolls instead of the thread.
 *
 * MARKING READ HAPPENS ON ARRIVAL AND ON EVERY MESSAGE, not on scroll. The
 * watermark only moves forward server-side, so the worst case is a channel
 * read as caught up while a message lands a second later — and that message is
 * on screen, which is what an unread count exists to prevent.
 */

export function ChatScreen({
  workspaceId,
  workspaceName,
  viewer,
}: {
  workspaceId: string;
  workspaceName: string;
  viewer: ChatSender | null;
}) {
  const chat = useChatSocket(workspaceId, viewer);

  useEffect(() => {
    void markChannelReadAction(workspaceId);
  }, [workspaceId, chat.messages.length]);

  const typists = chat.typing.filter((who) => who.id !== viewer?.id);
  const online = chat.presence.length;

  /* Typing wins over presence: it is the more specific fact, and it is the one
     that changes while somebody is looking at it. */
  const status =
    typists.length === 1
      ? `${typists[0].name ?? "Someone"} is typing…`
      : typists.length > 1
        ? `${typists.length} people are typing…`
        : online > 1
          ? `${online} online`
          : "Only you here";

  return (
    <section className="flex h-full min-h-0 flex-col">
      <ChatHeader
        workspaceName={workspaceName}
        presence={chat.presence}
        viewerId={viewer?.id ?? null}
        status={status}
      />

      <ChatNotice error={chat.error} onDismiss={chat.dismissError} />

      <ChatThread
        messages={chat.messages}
        viewerId={viewer?.id ?? null}
        hasOlder={chat.hasOlder}
        ready={chat.ready}
        onEdit={chat.edit}
        onDelete={chat.remove}
        onLoadOlder={chat.loadOlder}
      />

      <ChatComposer onSend={chat.send} onTyping={chat.signalTyping} />
    </section>
  );
}
