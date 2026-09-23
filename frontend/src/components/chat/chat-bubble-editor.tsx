"use client";

import { useState } from "react";

/*
 * Editing a message in place, inside its own bubble.
 *
 * ITS OWN FILE so `chat-bubble.tsx` stays a rendering decision and this stays
 * an input: the bubble decides who may edit, this decides what Enter and Esc
 * do. It also keeps both files clear of the 150-line cap.
 *
 * A plain `<textarea>`, not `ui/text-area.tsx`: that one is a labelled,
 * uncontrolled FORM field with its own validation and no key handling, and an
 * editor is the opposite — controlled, label-less, and defined by its keys.
 */

export function ChatBubbleEditor({
  content,
  onSave,
  onCancel,
}: {
  content: string;
  onSave: (next: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(content);

  return (
    <span className="block">
      <textarea
        value={draft}
        rows={2}
        aria-label="Edit message"
        data-autofocus
        className="w-full resize-none rounded-sm border border-border-strong bg-surface px-2 py-1 text-sm text-text"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSave(draft.trim());
          }
        }}
      />
      <span className="mt-1 flex gap-2 text-2xs text-text-muted">
        <button type="button" onClick={() => onSave(draft.trim())} className="font-semibold">
          Save
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <span className="text-text-subtle">Enter saves · Esc cancels</span>
      </span>
    </span>
  );
}
