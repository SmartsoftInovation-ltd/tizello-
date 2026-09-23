"use client";

import { ChatAvatar } from "@/components/chat/chat-avatar";
import { ChatHeaderActions } from "@/components/chat/chat-header-actions";
import type { ChatPresence } from "@/types/chat";

/*
 * The band above the thread: who this channel is, who is in it, and the chip
 * row.
 *
 * Its own file because `ChatScreen` is about wiring a socket to a thread and a
 * composer, and none of this is that.
 */

/** Beyond this the faces stop being recognisable and start being a wall. */
const FACES = 5;

export function ChatHeader({
  workspaceName,
  presence,
  viewerId,
  status,
}: {
  workspaceName: string;
  presence: ChatPresence[];
  viewerId: string | null;
  /** The line under the name: who is typing, or who is here. */
  status: string;
}) {
  const online = presence.length;

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        {/* The workspace\u2019s own disc, the way a chat names the room it is.
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
            {/* Green only when somebody ELSE is connected \u2014 a dot that is
                always on says nothing, since the reader is always here. */}
            {online > 1 && (
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-success" />
            )}
          </h1>
          <p className="truncate text-2xs text-text-subtle" aria-live="polite">
            {status}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Presence as faces, capped: a workspace of forty would otherwise put
            forty initials in a header. Each carries the person\u2019s own hue and
            photo \u2014 the same `ChatAvatar` the thread uses \u2014 so a face here and
            a message down there are recognisably one person. The ring is
            `border-surface`, the header\u2019s own colour, which is what makes an
            overlapping stack read as separate discs. */}
        <ul className="flex -space-x-1.5">
          {presence.slice(0, FACES).map((who) => (
            <li key={who.id}>
              <ChatAvatar
                sender={who}
                isOwn={who.id === viewerId}
                className="size-6 border-2 border-surface"
              />
            </li>
          ))}
          {online > FACES && (
            <li className="flex size-6 items-center justify-center rounded-full border-2 border-surface bg-chip text-2xs font-semibold text-text-muted">
              +{online - FACES}
            </li>
          )}
        </ul>

        <ChatHeaderActions />
      </div>
    </header>
  );
}
