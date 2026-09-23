"use client";

import { useEffect, useRef, useState } from "react";

/*
 * The message box.
 *
 * ENTER SENDS, SHIFT+ENTER BREAKS A LINE — the convention every chat client
 * has trained people into. A send button is drawn as well, because Enter is
 * invisible and touch keyboards do not have a shift.
 *
 * THE TYPING SIGNAL IS DEBOUNCED IN BOTH DIRECTIONS: `typing:start` is sent
 * once per burst rather than per keystroke (the server's token bucket is 5 per
 * 10s, and a fast typist would otherwise spend it in a word), and `typing:stop`
 * follows a pause. The server has its own 6-second failsafe for a client that
 * crashes mid-word, so a missed stop is untidy rather than permanent.
 */

/** Long enough to cover a pause for thought, short enough to feel live. */
const STOP_AFTER_MS = 2500;

/** Mirrors `CONTENT_MAX` in the API's validator — the server is the authority. */
const MAX = 4000;

/* A pill, WhatsApp's shape: the input is the full width of the bar with the
   send button as a disc beside it. `field-sizing-content` grows it line by line
   up to the max height, so a pasted paragraph is readable without the bar
   taking over the screen. */
const FIELD =
  "max-h-32 w-full resize-none rounded-lg border border-border bg-surface px-4 py-2 text-sm text-text transition-colors duration-100 ease-standard [field-sizing:content] placeholder:text-text-subtle focus-visible:border-border-strong";

export function ChatComposer({
  onSend,
  onTyping,
}: {
  onSend: (content: string) => void;
  onTyping: (active: boolean) => void;
}) {
  const [value, setValue] = useState("");
  const typing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTyping = () => {
    if (timer.current) clearTimeout(timer.current);
    if (!typing.current) return;

    typing.current = false;
    onTyping(false);
  };

  /* A tab closed mid-word must not leave "… is typing" on everybody else's
     screen for the server's whole failsafe window. */
  useEffect(() => stopTyping);

  const handleChange = (next: string) => {
    setValue(next);

    if (!typing.current && next.trim()) {
      typing.current = true;
      onTyping(true);
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(stopTyping, STOP_AFTER_MS);
  };

  const submit = () => {
    const content = value.trim();
    if (!content) return;

    onSend(content.slice(0, MAX));
    setValue("");
    stopTyping();
  };

  return (
    <div className="flex items-end gap-2 border-t border-border bg-surface p-3">
      {/* A plain <textarea>, not `ui/text-area.tsx`: that one is a labelled,
          uncontrolled FORM field with its own validation and no key handling,
          and a composer is the opposite — controlled, label-less, and defined
          by what Enter does. */}
      <textarea
        value={value}
        rows={2}
        maxLength={MAX}
        placeholder="Write a message…"
        aria-label="Message"
        data-autofocus
        className={FIELD}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={stopTyping}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey) return;
          event.preventDefault();
          submit();
        }}
      />
      {/* A disc, not a labelled button: it sits at the end of a pill and the
          arrow is the whole affordance. `aria-label` carries the name, and it
          is disabled rather than hidden on an empty draft so the control does
          not appear and disappear under the pointer. */}
      <button
        type="button"
        onClick={submit}
        disabled={!value.trim()}
        aria-label="Send message"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-on-brand transition-[opacity,transform] duration-100 ease-standard hover:bg-brand-400 active:translate-y-px disabled:pointer-events-none disabled:opacity-40"
      >
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
  );
}
