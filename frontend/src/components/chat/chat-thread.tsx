"use client";

import { Fragment, useEffect, useRef } from "react";
import { ChatBubble } from "@/components/chat/chat-bubble";
import { Button } from "@/components/ui/button";
import { groupMessages } from "@/lib/chat-grouping";
import type { ChatMessage } from "@/types/chat";

/*
 * The scroll region: day dividers, turns, bubbles.
 *
 * IT STICKS TO THE BOTTOM ONLY IF THE READER IS ALREADY THERE. Scrolling on
 * every arrival is what makes a channel unreadable — you scroll up to read
 * something, somebody says "ok", and you are yanked back down. "Already there"
 * is within 80px, which covers the pixel or two a layout settles by without
 * counting somebody who scrolled away deliberately.
 *
 * `overflow-anchor` is the other half, and it is why loading older messages is
 * a button rather than a scroll-to-top trigger: the browser keeps the reader's
 * position when content is prepended above them, which hand-rolled infinite
 * scroll has to reimplement with saved scroll heights and usually gets wrong.
 *
 * The canvas is `bg-canvas` so the `surface` bubbles on it have something to
 * sit on — a chat where bubbles and background are the same colour is a list
 * of paragraphs.
 */

const NEAR_BOTTOM_PX = 80;

export function ChatThread({
  messages,
  viewerId,
  canModerate,
  hasOlder,
  ready,
  onEdit,
  onDelete,
  onLoadOlder,
}: {
  messages: ChatMessage[];
  viewerId: string | null;
  canModerate: boolean;
  hasOlder: boolean;
  ready: boolean;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onLoadOlder: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const rows = groupMessages(messages);

  useEffect(() => {
    const element = scroller.current;
    if (!element || !atBottom.current) return;

    element.scrollTop = element.scrollHeight;
  }, [messages.length]);

  return (
    <div
      ref={scroller}
      className="min-h-0 flex-1 overflow-y-auto bg-canvas py-3"
      onScroll={(event) => {
        const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
        atBottom.current = scrollHeight - scrollTop - clientHeight < NEAR_BOTTOM_PX;
      }}
    >
      {hasOlder && (
        <div className="flex justify-center pb-3">
          <Button type="button" size="sm" variant="subtle" onClick={onLoadOlder}>
            Load earlier messages
          </Button>
        </div>
      )}

      {ready && rows.length === 0 && (
        <p className="px-6 py-16 text-center text-sm text-text-subtle">
          No messages yet. Say something — everyone in this workspace is here.
        </p>
      )}

      <ul>
        {/* A Fragment, not a wrapping <div>: only <li> is a valid child of
            <ul>, and a div here quietly breaks the list semantics a screen
            reader announces. The divider is therefore its own <li>. */}
        {rows.map((row) => (
          <Fragment key={row.message.id}>
            {row.dayLabel && (
              /* A pill BETWEEN two rules: the rules say "everything below is a
                 new day" at a glance, and the pill keeps the label legible at
                 11px over whatever is behind it. `aria-hidden` on the rules so
                 a screen reader hears the date once, not twice with two
                 separators. */
              <li className="my-4 flex items-center gap-3 px-6">
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
                <span className="rounded-xs bg-chip px-2.5 py-1 text-2xs font-semibold tracking-widest text-text-muted uppercase shadow-card">
                  {row.dayLabel}
                </span>
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
              </li>
            )}
            <ChatBubble
              row={row}
              isOwn={row.message.sender?.id === viewerId}
              canDelete={canModerate}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </Fragment>
        ))}
      </ul>
    </div>
  );
}
