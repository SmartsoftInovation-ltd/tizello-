"use client";

import { useEffect, useRef } from "react";
import { ChatMessageRow } from "@/components/chat/chat-message-row";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/types/chat";

/*
 * The scroll container.
 *
 * IT STICKS TO THE BOTTOM ONLY IF THE READER IS ALREADY THERE. Scrolling on
 * every arrival is what makes a channel unreadable: you scroll up to read
 * something, somebody says "ok", and you are yanked back down. "Already there"
 * is within 80px of the bottom, which covers the pixel or two a layout settles
 * by without counting somebody who has deliberately scrolled away.
 *
 * Loading older messages is a button rather than a scroll-to-top trigger. An
 * infinite upward scroll has to restore the scroll offset after prepending or
 * the viewport jumps, and a button lets the browser's own anchoring do that
 * work correctly for free.
 */

const NEAR_BOTTOM_PX = 80;

export function ChatMessageList({
  messages,
  viewerId,
  canDelete,
  hasOlder,
  ready,
  onEdit,
  onDelete,
  onLoadOlder,
}: {
  messages: ChatMessage[];
  viewerId: string | null;
  canDelete: boolean;
  hasOlder: boolean;
  ready: boolean;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onLoadOlder: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const count = messages.length;

  useEffect(() => {
    const element = scroller.current;
    if (!element || !atBottom.current) return;

    element.scrollTop = element.scrollHeight;
  }, [count]);

  return (
    <div
      ref={scroller}
      className="flex-1 overflow-y-auto"
      onScroll={(event) => {
        const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
        atBottom.current = scrollHeight - scrollTop - clientHeight < NEAR_BOTTOM_PX;
      }}
    >
      {hasOlder && (
        <div className="flex justify-center p-3">
          <Button type="button" size="sm" variant="subtle" onClick={onLoadOlder}>
            Load earlier messages
          </Button>
        </div>
      )}

      {ready && count === 0 && (
        <p className="p-6 text-center text-sm text-text-subtle">
          No messages yet. Say something to the people on this project.
        </p>
      )}

      <ul className="divide-y divide-border/60">
        {messages.map((message) => (
          <ChatMessageRow
            key={message.id}
            message={message}
            isOwn={message.sender?.id === viewerId}
            canDelete={canDelete || message.sender?.id === viewerId}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </div>
  );
}
