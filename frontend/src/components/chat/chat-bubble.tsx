"use client";

import { useState } from "react";
import { ChatBubbleEditor } from "@/components/chat/chat-bubble-editor";
import { clockTime, type ChatRow } from "@/lib/chat-grouping";
import { isPending } from "@/lib/chat-messages";
import { cn } from "@/lib/cn";

/*
 * One message, WhatsApp-shaped: the reader's own on the right in a tinted
 * bubble, everybody else's on the left on `surface`.
 *
 * WHY A TINT AND NOT THE BRAND FILL. `bg-brand-100 text-brand-800` is the pair
 * DESIGN-SYSTEM.md measures as safe, and — unlike the semantic tokens — the
 * brand ramp is identical in both themes, so one declaration is readable in
 * light and dark alike. `bg-brand-500` would need `text-on-brand` and would
 * make every one of your own messages shout.
 *
 * THE TAIL IS ONE CORNER, not an SVG notch: the bubble at the START of a turn
 * squares off the corner nearest its author and the rest of the run stays
 * fully rounded. That is what makes a run read as one turn, and it costs a
 * class instead of a pseudo-element.
 *
 * The timestamp sits inside the bubble, bottom-right, and only on the LAST
 * message of a turn. A clock on every line is noise when four of them arrived
 * in the same minute.
 */

const OWN = "bg-brand-100 text-brand-900";
const THEIRS = "border border-border bg-surface text-text";

export function ChatBubble({
  row,
  isOwn,
  canDelete,
  onEdit,
  onDelete,
}: {
  row: ChatRow;
  isOwn: boolean;
  canDelete: boolean;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}) {
  const { message, startsTurn, endsTurn } = row;
  const [editing, setEditing] = useState(false);
  const pending = isPending(message);

  return (
    <li
      className={cn(
        "group flex px-3",
        endsTurn ? "pb-2" : "pb-0.5",
        isOwn ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[min(32rem,78%)] rounded-lg px-3 py-1.5 text-sm shadow-card",
          message.deleted ? "border border-border bg-transparent" : isOwn ? OWN : THEIRS,
          /* The tail. Squared on the side the author is on, and only on the
             first bubble of a run. */
          startsTurn && (isOwn ? "rounded-tr-xs" : "rounded-tl-xs"),
          pending && "opacity-60",
        )}
      >
        {/* Group chat needs a name on other people's messages and never on
            your own — you know who you are. */}
        {startsTurn && !isOwn && !message.deleted && (
          <p className="text-2xs font-semibold text-text-brand">
            {message.sender?.name ?? message.sender?.email ?? "Deleted user"}
          </p>
        )}

        {message.deleted ? (
          <p className="text-xs text-text-subtle italic">This message was deleted</p>
        ) : editing ? (
          <ChatBubbleEditor
            content={message.content ?? ""}
            onCancel={() => setEditing(false)}
            onSave={(next) => {
              if (next && next !== message.content) onEdit(message.id, next);
              setEditing(false);
            }}
          />
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}

        <p
          className={cn(
            "mt-0.5 flex items-center justify-end gap-1.5 text-[10px] leading-none",
            isOwn && !message.deleted ? "text-brand-800" : "text-text-subtle",
          )}
        >
          {/* The controls live in the metadata row so they cannot reflow the
              text, and appear on hover or keyboard focus — `focus-within`
              matters, or they are unreachable without a pointer. */}
          {!message.deleted && !pending && !editing && (isOwn || canDelete) && (
            <span className="opacity-0 transition-opacity duration-100 ease-standard group-hover:opacity-100 group-focus-within:opacity-100">
              {isOwn && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="mr-1.5 underline decoration-dotted"
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete(message.id)}
                className="underline decoration-dotted"
              >
                Delete
              </button>
            </span>
          )}

          {message.editedAt && !message.deleted && <span>edited</span>}
          {(endsTurn || message.deleted) && <span>{clockTime(message.createdAt)}</span>}
          {pending && <span aria-label="Sending">⋯</span>}
        </p>
      </div>
    </li>
  );
}
