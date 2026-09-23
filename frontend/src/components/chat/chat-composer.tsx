"use client";

import { useState } from "react";
import { ChatAttachButton } from "@/components/chat/chat-attach-button";
import { ChatComposerAttachments } from "@/components/chat/chat-composer-attachments";
import { ClipGlyph, PlusGlyph } from "@/components/chat/chat-icons";
import { useChatDraft } from "@/components/chat/use-chat-draft";
import { useTypingSignal } from "@/components/chat/use-typing-signal";
import { EmojiPickerPopover } from "@/components/workspace/emoji-picker-popover";
import { CONTENT_MAX } from "@/lib/chat-limits";
import type { ChatAttachment } from "@/types/chat";

/*
 * The message box.
 *
 * ENTER SENDS, SHIFT+ENTER BREAKS A LINE — the convention every chat client
 * has trained people into. A send button is drawn as well, because Enter is
 * invisible and touch keyboards do not have a shift.
 *
 * The typing signal is debounced in both directions by `useTypingSignal`,
 * which owns that whole concern.
 *
 * FILES ARE UPLOADED WHEN THEY ARE PICKED, not when the message is sent, and
 * wait here as chips until it goes — see `chat-attach-button.tsx`. A message
 * may therefore be files with no text at all, which the API allows and the
 * send button has to agree with.
 *
 * TWO PICKERS, DIFFERENT `accept` LISTS, one API allowlist behind them: "+"
 * takes photos and clips, the paperclip takes documents. The split is the
 * design's and it is a good one — somebody reaching for "+" to share a photo
 * should not be offered a list of spreadsheets.
 */

/* Mirrors the API's validator; see `lib/chat-limits.ts`. */
const MAX = CONTENT_MAX;

/** Matches `MAX_ATTACHMENTS` in `chat.validator.js`. */
const MAX_FILES = 5;

/* Narrower than the API's allowlist on purpose — each button offers the half
   it is named for. Both halves are still checked server-side. */
const MEDIA_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm";
const DOC_ACCEPT = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
].join(",");

/* ONE LINE TALL AT REST. `rows={1}` plus `field-sizing: content` means the bar
   is the height of a line of text and grows only when the text does, up to
   `max-h-28` — a two-row box that is empty most of the time is a permanent
   chunk of the thread given to nothing.

   The field carries no border of its own: it sits inside the pill below, and a
   border on both draws two rounded rectangles a pixel apart. */
const FIELD =
  "max-h-28 w-full resize-none bg-transparent py-1 text-sm leading-6 text-text [field-sizing:content] placeholder:text-text-subtle focus:outline-none";

/* The pill. Focus is drawn HERE rather than on the field, because the ring has
   to describe the whole control the reader is typing into — the field, the
   emoji button and the clip are one input as far as anyone using it is
   concerned. */
const PILL =
  "flex flex-1 items-end gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 transition-colors duration-100 ease-standard focus-within:border-border-strong";

export function ChatComposer({
  workspaceId,
  onSend,
  onTyping,
}: {
  /** Whose draft this is — the unsent text is remembered per workspace. */
  workspaceId: string;
  onSend: (content: string, attachments: ChatAttachment[]) => void;
  onTyping: (active: boolean) => void;
}) {
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<ChatAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const typing = useTypingSignal(onTyping);

  useChatDraft(workspaceId, { text: value, files }, (draft) => {
    setValue(draft.text);
    setFiles(draft.files.slice(0, MAX_FILES));
  });

  const handleChange = (next: string) => {
    setValue(next);
    typing.keystroke(next);
  };

  const attach = (file: ChatAttachment) => {
    setError(null);
    setFiles((held) => (held.length >= MAX_FILES ? held : [...held, file]));
  };

  const empty = !value.trim() && files.length === 0;

  const submit = () => {
    if (empty) return;

    onSend(value.trim().slice(0, MAX), files);
    setValue("");
    setFiles([]);
    typing.stop();
  };

  return (
    <div className="border-t border-border bg-surface px-3 py-2.5">
      <ChatComposerAttachments
        files={files}
        error={error}
        onRemove={(id) => setFiles((held) => held.filter((file) => file.id !== id))}
        onDismissError={() => setError(null)}
      />

      <div className="flex items-end gap-2">
        {/* OUTSIDE the pill, as the design has it: it is not part of what you
            are typing, it is what you send instead of typing. */}
        <ChatAttachButton
          accept={MEDIA_ACCEPT}
          label="Share a photo or video"
          reason="Photos and short video, up to 10 MB"
          className="mb-0.5 size-9 rounded-full bg-surface-sunken text-text-muted"
          onUploaded={attach}
          onError={setError}
        >
          <PlusGlyph className="size-4" />
        </ChatAttachButton>

        <div className={PILL}>
          {/* A plain <textarea>, not `ui/text-area.tsx`: that one is a labelled,
              uncontrolled FORM field with its own validation and no key
              handling, and a composer is the opposite — controlled, label-less,
              and defined by what Enter does. */}
          <textarea
            value={value}
            rows={1}
            maxLength={MAX}
            placeholder="Write a message…"
            aria-label="Message"
            data-autofocus
            className={FIELD}
            onChange={(event) => handleChange(event.target.value)}
            onBlur={typing.stop}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey) return;
              event.preventDefault();
              submit();
            }}
          />

          {/* The workspace icon picker, reused whole: it already solves being a
              360px panel inside a scrolling container, which is the hard part
              (its header explains the popover dance). APPENDED rather than
              inserted at the caret — doing better would mean tracking the
              textarea's selection across every keystroke, and people reach for
              this at the end of a line. */}
          <EmojiPickerPopover onSelect={(emoji) => handleChange(value + emoji)} />

          <ChatAttachButton
            accept={DOC_ACCEPT}
            label="Attach a document"
            reason="PDF, Word, Excel, CSV, text or zip, up to 10 MB"
            className="mb-0.5 size-7 rounded-full text-text-subtle"
            onUploaded={attach}
            onError={setError}
          >
            <ClipGlyph className="size-4" />
          </ChatAttachButton>
        </div>

        {/* The rule between the pill and the send disc: everything left of it
            is composing, the disc is the act of sending. */}
        <span aria-hidden="true" className="mx-0.5 mb-2.5 h-5 w-px bg-border" />

        <button
          type="button"
          onClick={submit}
          disabled={empty}
          aria-label="Send message"
          className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-on-brand transition-[opacity,transform] duration-100 ease-standard hover:bg-brand-400 active:translate-y-px disabled:pointer-events-none disabled:opacity-40"
        >
          {/* NO PENDING STATE. The draft is already in the thread by the time
              this could change, so a spinner here would report on a message
              the reader can already see. */}
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
            <path
              d="M2 8l12-5.5L9.5 14 8 9.5z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
