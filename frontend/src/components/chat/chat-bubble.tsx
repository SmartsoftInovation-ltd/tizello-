"use client";

import { ChatAttachments } from "@/components/chat/chat-attachments";
import { ChatAvatar } from "@/components/chat/chat-avatar";
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
 * THE CLOCK IS ITS OWN LINE, under the text and aligned to the end of the
 * bubble. It has been all three ways now — floated into the last line, sharing
 * the row as a second column, and here — and this is the one that stays: a
 * message and the time it was sent are two different things, and a clock
 * sitting immediately after the last word reads as part of the sentence.
 *
 * EVERY MESSAGE HAS AN AVATAR, the sender's own, on the side their bubble is.
 * Only the last bubble of a turn draws it — a run of four messages with four
 * identical discs beside them is a column of noise — and a spacer holds the
 * rest of the run in line.
 *
 * EDIT AND DELETE BELONG TO THE AUTHOR, so the ⋮ menu is drawn on the reader's
 * own messages and on nothing else. A workspace OWNER used to get Delete on
 * everybody's; that is gone from the API too (`chat.service.js#deleteMessage`),
 * so a control here would have been a lie rather than an optimism.
 *
 * The menu opens a DIALOG (`chat-message-dialogs.tsx`) rather than editing in
 * place: this component therefore holds no editing state at all, and asks its
 * parent instead.
 */

/* A photo or a clip with no caption gets NO bubble at all — no fill, no
   padding, no shadow. A picture is already a rectangle with edges; wrapping it
   in a tinted card with 8px of padding draws a frame around a frame, which is
   what made image messages look boxed-in. The clock still needs somewhere to
   sit, so it goes back over the media's bottom edge. */
const BARE = "bg-transparent p-0 shadow-none";

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
  onEdit,
  onDelete,
}: {
  row: ChatRow;
  isOwn: boolean;
  /** Asks the thread to open the edit dialog for this message. */
  onEdit: (message: ChatRow["message"]) => void;
  /** Asks the thread to open the delete confirm for this message. */
  onDelete: (message: ChatRow["message"]) => void;
}) {
  const { message, endsTurn } = row;
  const pending = isPending(message);

  /* A message still on its way to the server has no id the server knows, so
     there is nothing to edit or delete yet. */
  const actionable = isOwn && !message.deleted && !pending;

  /* Media with no words — see `BARE`. A document is NOT media: its row is a
     chip that needs the bubble behind it to read as part of the message. */
  const mediaOnly =
    !message.deleted &&
    !message.content &&
    message.attachments.length > 0 &&
    message.attachments.every(
      (file) => file.mime.startsWith("image/") || file.mime.startsWith("video/"),
    );

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

      {/* On the left of the bubble, which for an own message is the empty half
          of the row — so the menu opens into space rather than over the
          conversation. */}
      {actionable && (
        <ChatBubbleMenu
          onEdit={() => onEdit(message)}
          onDelete={() => onDelete(message)}
        />
      )}

      <div
        className={cn(
          SHAPE,
          "max-w-[min(34rem,76%)] min-w-0 text-sm leading-snug shadow-card",
          message.deleted ? "border border-border bg-transparent" : isOwn ? OWN : THEIRS,
          mediaOnly && BARE,
          /* The tail, on the corner where the turn ends. */
          endsTurn && (isOwn ? "rounded-br-xs" : "rounded-bl-xs"),
          /* A LIGHT dim, not a fade: the message is written, it is simply not
             acknowledged yet, and at 60% it read as disabled. */
          pending && "opacity-90",
        )}
      >
        {message.deleted ? (
          <p className="text-xs text-text-subtle italic">
            This message was deleted
            <span className="ml-2 text-[10px] not-italic">
              {clockTime(message.createdAt)}
            </span>
          </p>
        ) : (
          <>
            <ChatAttachments attachments={message.attachments} isOwn={isOwn} />

            {/* A message may be files with no text — the API allows it and the
                composer sends it, so this has to not draw an empty line. */}
            {message.content && (
              <p className="break-words whitespace-pre-wrap">{message.content}</p>
            )}

            {/* `select-none` so copying a message does not carry a timestamp
                into the paste. */}
            <span
              className={cn(
                "flex select-none items-center justify-end gap-1 text-[10px] leading-none",
                /* Over the media's bottom edge when there is no bubble to sit
                   in, and legible on whatever the photo happens to be there. */
                mediaOnly
                  ? "-mt-6 mr-2 rounded-xs bg-ink-950/60 px-1.5 py-0.5 text-ink-0"
                  : "mt-1",
                !mediaOnly && (isOwn ? "text-brand-700" : "text-text-subtle"),
              )}
            >
              {message.editedAt && <span>edited</span>}
              {/* A CLOCK, NOT A SPINNER, while the server confirms. The time
                  shown is this client's own guess and will be corrected within
                  a round trip; a spinner in its place made an instant action
                  look like work, and it span for the whole of a reconnect —
                  which is a normal five-minute event here, not a failure. */}
              {pending && (
                <svg viewBox="0 0 16 16" className="size-3" aria-label="Sending">
                  <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
              {clockTime(message.createdAt)}
            </span>
          </>
        )}
      </div>

      {isOwn && <TurnAvatar row={row} isOwn />}
    </li>
  );
}
