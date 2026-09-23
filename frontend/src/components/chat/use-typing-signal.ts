"use client";

import { useCallback, useEffect, useRef } from "react";

/*
 * The "… is typing" signal, debounced in both directions.
 *
 * `typing:start` goes once per burst rather than per keystroke — the server's
 * token bucket is 5 per 10s, and a fast typist would spend it inside a word —
 * and `typing:stop` follows a pause. The server has its own 6-second failsafe
 * for a client that crashes mid-word, so a missed stop is untidy rather than
 * permanent.
 *
 * ITS OWN HOOK because the composer is about text and files, and this is a
 * side-effect of typing that has nothing to do with either.
 *
 * `onTyping` MUST BE STABLE — `useChatSocket` returns a `useCallback`, which
 * it is. An inline arrow would change identity every render, which would make
 * `stop` change with it and run the cleanup below on every keystroke: a
 * `typing:stop` between each letter, which is the exact opposite of debouncing.
 */

/** Long enough to cover a pause for thought, short enough to feel live. */
const STOP_AFTER_MS = 2500;

export function useTypingSignal(onTyping: (active: boolean) => void) {
  const typing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!typing.current) return;

    typing.current = false;
    onTyping(false);
  }, [onTyping]);

  const keystroke = useCallback(
    (text: string) => {
      if (!typing.current && text.trim()) {
        typing.current = true;
        onTyping(true);
      }

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(stop, STOP_AFTER_MS);
    },
    [onTyping, stop],
  );

  /* A tab closed mid-word must not leave "… is typing" on everybody else's
     screen for the server's whole failsafe window. */
  useEffect(() => stop, [stop]);

  return { keystroke, stop };
}
