"use client";

import { useState } from "react";
import { ChatAvatar } from "@/components/chat/chat-avatar";
import { ChatBubbleEditor } from "@/components/chat/chat-bubble-editor";
import { ChatBubbleMenu } from "@/components/chat/chat-bubble-menu";
import { clockTime, type ChatRow } from "@/lib/chat-grouping";
import { isPending } from "@/lib/chat-messages";
import { cn } from "@/lib/cn";

/*
 * One message, WhatsApp-shaped: the reader's own on the right in a tinted
 * bubble, everybody else's on the left on `surface`.
 *
 * WHY A TINT AND NOT THE BRAND FILL. `bg-brand-100` with brand ink is the pair
 * DESIGN-SYSTEM.md measures as safe, and — unlike the semantic tokens — the
 * brand ramp is identical in both themes, so one declaration is readable in
 * light and dark alike. `bg-brand-500` would need `text-on-brand` and would
 * make every one of your own messages shout.
 *
 * THE TAIL IS ONE CORNER, not an SVG notch: the LAST bubble of a turn squares
 * off the bottom corner nearest its author and the rest of the run stays fully
 * rounded, so a run reads as one turn and the tail lands where the turn ends.
 * It costs a class instead of a pseudo-element.
 *
 * NO NAME ROW ON EITHER SIDE. It went from every message, to other people's
 * only, to nowhere: a label above two characters of text was the single thing
 * making both sides of the thread tall and uneven, and the question it answered
 * is answered better beside the bubble. The sender is the coloured disc — one
 * hue per person (`lib/chat-colors.ts`), their initial on it, and their full
 * name in its tooltip and accessible name. If a written name is wanted back, it
 * belongs ABOVE the first bubble of a turn, not inside every one of them.
 *
 * THE CLOCK SHARES THE TEXT'S ROW, as its last column rather than its own
 * line: a flex row with the text flexible and the time fixed puts "HI  12:45"
 * on one line and drops the time to the bottom-right of a paragraph, which is
 * the one arrangement that reads well at both lengths. A floated span got the
 * short case right and left long messages ragged; a separate line got the long
 * case right and made short ones square.
 *
 * EVERY MESSAGE HAS AN AVATAR, the sender's own, on the side their bubble is.
 * Only the last bubble of a turn draws it — a run of four messages with four
 * identical discs beside them is a column of noise — and a spacer holds the
 * rest of the run in line.
 *
 * Edit and Delete are NOT in the bubble: they are a ⋮ menu outside it
 * (`chat-bubble-menu.tsx`), because three unrelated things on one line is what
 * made this row hard to read.
 */

const OWN = "bg-brand-100 text-brand-950";
/* NO BORDER, matching the reader's own bubble: a hairline on one side of the
   thread and none on the other made received messages look like a different
   component. `surface` on `canvas` is already a step of contrast in both
   themes, and `shadow-card` does the rest of the lifting. */
const THEIRS = "bg-surface text-text";

/* Roomier than the 8px card radius the rest of the app uses: a chat bubble is
   the one surface here that should read as soft. */
const SHAPE = "rounded-xl px-3 py-2";

/** The sender's disc, drawn once per turn with a spacer holding the rest. */
function TurnAvatar({ row, isOwn }: { row: ChatRow; isOwn: boolean }) {
  return row.endsTurn ? (
    <ChatAvatar sender={row.message.sender} isOwn={isOwn} />
  ) : (
    <span aria-hidden="true" className="size-7 shrink-0" />
  );
}

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
  const { message, endsTurn } = row;
  const [editing, setEditing] = useState(false);
  const pending = isPending(message);

  const actionable = !message.deleted && !pending && !editing;

  return (
    <li
      className={cn(
        "group flex items-end gap-2 px-3",
        endsTurn ? "pb-2.5" : "pb-1",
        isOwn ? "justify-end" : "justify-start",
      )}
    >
      {/* The disc sits level with the last line of a turn, the way a group
          thread reads; a spacer keeps the rest of the run aligned under it. */}
      {!isOwn && <TurnAvatar row={row} isOwn={false} />}

      {/* Own messages put the menu on the left of the bubble and everybody
          else's on the right, so it always opens into the empty half of the
          row rather than over the conversation. */}
      {isOwn && actionable && (
        <ChatBubbleMenu
          canEdit
          canDelete
          onEdit={() => setEditing(true)}
          onDelete={() => onDelete(message.id)}
        />
      )}

      <div
        className={cn(
          SHAPE,
          "max-w-[min(34rem,76%)] min-w-0 text-sm leading-snug shadow-card",
          message.deleted ? "border border-border bg-transparent" : isOwn ? OWN : THEIRS,
          /* The tail, on the corner where the turn ends. */
          endsTurn && (isOwn ? "rounded-br-xs" : "rounded-bl-xs"),
          pending && "opacity-60",
        )}
      >
        {message.deleted ? (
          <p className="text-xs text-text-subtle italic">
            This message was deleted
            <span className="ml-2 text-[10px] not-italic">
              {clockTime(message.createdAt)}
            </span>
          </p>
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
          <div className="flex items-end gap-2">
            <p className="min-w-0 flex-1 break-words whitespace-pre-wrap">
              {message.content}
            </p>

            {/* `select-none` so copying a message does not carry a timestamp
                into the paste. `translate-y-px` drops it onto the text's
                baseline rather than its line box, which at 10px against 14px
                otherwise sits visibly high. */}
            <span
              className={cn(
                "flex shrink-0 translate-y-px select-none items-center gap-1 text-[10px] leading-none",
                isOwn ? "text-brand-700" : "text-text-subtle",
              )}
            >
              {message.editedAt && <span>edited</span>}
              {pending ? <span aria-label="Sending">⋯</span> : clockTime(message.createdAt)}
            </span>
          </div>
        )}
      </div>

      {isOwn && <TurnAvatar row={row} isOwn />}

      {!isOwn && actionable && canDelete && (
        <ChatBubbleMenu
          canEdit={false}
          canDelete
          onEdit={() => undefined}
          onDelete={() => onDelete(message.id)}
        />
      )}
    </li>
  );
}
