"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

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

const CLASSES = "w-full resize-none rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text transition-colors duration-100 ease-standard placeholder:text-text-subtle hover:border-border-strong";

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
    <div className="flex items-end gap-2 border-t border-border p-3">
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
        className={CLASSES}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={stopTyping}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey) return;
          event.preventDefault();
          submit();
        }}
      />
      <Button type="button" onClick={submit} disabled={!value.trim()}>
        Send
      </Button>
    </div>
  );
}
