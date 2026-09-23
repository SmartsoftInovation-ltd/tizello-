"use client";

import { useEffect } from "react";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatThread } from "@/components/chat/chat-thread";
import { useChatSocket } from "@/components/chat/use-chat-socket";
import { markChannelReadAction } from "@/lib/actions/chat-actions";
import { avatarTone } from "@/lib/chat-colors";
import { cn } from "@/lib/cn";
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
  canModerate,
}: {
  workspaceId: string;
  workspaceName: string;
  viewer: ChatSender | null;
  /** Draws Delete on other people's messages. The API re-checks regardless. */
  canModerate: boolean;
}) {
  const chat = useChatSocket(workspaceId, viewer);

  useEffect(() => {
    void markChannelReadAction(workspaceId);
  }, [workspaceId, chat.messages.length]);

  const typists = chat.typing.filter((who) => who.id !== viewer?.id);
  const online = chat.presence.length;

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          {/* The workspace's own disc, the way a chat names the room it is.
              `brand-100` rather than a hashed hue: this one is not a person to
              tell apart from other people, it is the place. */}
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800"
          >
            {workspaceName.charAt(0).toUpperCase()}
          </span>

          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-sm font-semibold text-text">
              {workspaceName}
              {/* Green only when somebody ELSE is connected — a dot that is
                  always on says nothing, since the reader is always here. */}
              {online > 1 && (
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full bg-success"
                />
              )}
            </h1>
            <p className="truncate text-2xs text-text-subtle" aria-live="polite">
            {typists.length === 1
              ? `${typists[0].name ?? "Someone"} is typing…`
              : typists.length > 1
                ? `${typists.length} people are typing…`
                : online > 1
                  ? `${online} online`
                  : "Only you here"}
            </p>
          </div>
        </div>

        {/* Presence as faces, capped: a workspace of forty would otherwise put
            forty initials in a header. Each one carries the person's own hue —
            the same `lib/chat-colors.ts` table their disc in the thread uses,
            so a face here and a message down there are recognisably one
            person. The ring is `border-surface`, the header's own colour, which
            is what makes an overlapping stack read as separate discs. */}
        <ul className="flex -space-x-1.5">
          {chat.presence.slice(0, 5).map((who) => (
            <li
              key={who.id}
              title={who.name ?? who.email}
              className={cn(
                "flex size-6 items-center justify-center rounded-full border-2 border-surface text-2xs font-semibold",
                avatarTone(who.id),
              )}
            >
              {(who.name ?? who.email ?? "?").charAt(0).toUpperCase()}
            </li>
          ))}
          {online > 5 && (
            <li className="flex size-6 items-center justify-center rounded-full border-2 border-surface bg-chip text-2xs font-semibold text-text-muted">
              +{online - 5}
            </li>
          )}
        </ul>
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

      <ChatThread
        messages={chat.messages}
        viewerId={viewer?.id ?? null}
        canModerate={canModerate}
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
