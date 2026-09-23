"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { isPending } from "@/lib/chat-messages";
import { cn } from "@/lib/cn";
import type { ChatMessage } from "@/types/chat";

/*
 * One message.
 *
 * THREE STATES, AND THEY LOOK DIFFERENT ON PURPOSE: saved, pending (dimmed,
 * because a bubble that looks delivered when it may not be is a lie), and a
 * tombstone (the row is kept and emptied, matching what history returns, so a
 * reply quoting it does not dangle).
 *
 * The edit and delete controls are drawn from the SAME rules the server
 * enforces and are nothing more than a hint: only the author may edit, and the
 * author or a project manager may delete. A control this file failed to hide
 * would still be refused with `chat:error`.
 */

const initial = (message: ChatMessage) =>
  (message.sender?.name ?? message.sender?.email ?? "?").charAt(0).toUpperCase();

/* The same plain <textarea> the composer uses, and for the same reason:
   `ui/text-area.tsx` is an uncontrolled form field with no key handling. */
const EDIT_CLASSES = "w-full resize-none rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text transition-colors duration-100 ease-standard placeholder:text-text-subtle hover:border-border-strong";

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

export function ChatMessageRow({
  message,
  isOwn,
  canDelete,
  onEdit,
  onDelete,
}: {
  message: ChatMessage;
  isOwn: boolean;
  canDelete: boolean;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const pending = isPending(message);

  const submitEdit = () => {
    const next = draft?.trim();
    if (next && next !== message.content) onEdit(message.id, next);
    setDraft(null);
  };

  return (
    <li className={cn("flex gap-2 px-4 py-2", pending && "opacity-60")}>
      <Avatar className="mt-0.5 size-7 bg-chip text-2xs text-text-muted">
        <AvatarFallback>{initial(message)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="truncate text-xs font-semibold text-text">
            {message.sender?.name ?? message.sender?.email ?? "Deleted user"}
          </span>
          <span className="text-2xs text-text-subtle">{time(message.createdAt)}</span>
          {message.editedAt && !message.deleted && (
            <span className="text-2xs text-text-subtle">(edited)</span>
          )}
        </p>

        {message.deleted ? (
          <p className="text-sm text-text-subtle italic">Message deleted</p>
        ) : draft !== null ? (
          <div className="mt-1 space-y-2">
            <textarea
              value={draft}
              rows={2}
              aria-label="Edit message"
              data-autofocus
              className={EDIT_CLASSES}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setDraft(null);
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitEdit();
                }
              }}
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={submitEdit}>
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setDraft(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words text-text">
            {message.content}
          </p>
        )}

        {!message.deleted && !pending && draft === null && (isOwn || canDelete) && (
          <p className="mt-1 flex gap-2">
            {isOwn && (
              <button
                type="button"
                className="text-2xs text-text-subtle transition-colors duration-100 ease-standard hover:text-text"
                onClick={() => setDraft(message.content ?? "")}
              >
                Edit
              </button>
            )}
            <button
              type="button"
              className="text-2xs text-text-subtle transition-colors duration-100 ease-standard hover:text-danger"
              onClick={() => onDelete(message.id)}
            >
              Delete
            </button>
          </p>
        )}
      </div>
    </li>
  );
}
