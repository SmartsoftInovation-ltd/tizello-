"use client";

import { useEffect, useRef } from "react";
import type { ChatAttachment } from "@/types/chat";

/*
 * The unsent message, kept per workspace in `localStorage`, so leaving the
 * chat page — or reloading, or closing the tab — does not throw away what was
 * typed.
 *
 * FILES TRAVEL WITH THE TEXT. They are uploaded when picked (see
 * `chat-attach-button.tsx`), so a chip is already a stored file; dropping it
 * from the draft would orphan the upload as well as lose it.
 *
 * RESTORED AFTER MOUNT, not in `useState`'s initialiser: the composer is
 * server-rendered, where there is no storage, and an initial value that
 * differs between server and client is a hydration mismatch.
 *
 * Per-viewer convenience only, so every access is wrapped: private windows and
 * blocked site data throw, and a composer that cannot remember is still a
 * composer.
 */

type Draft = { text: string; files: ChatAttachment[] };

const keyOf = (workspaceId: string) => `tizello:chat-draft:${workspaceId}`;

function read(workspaceId: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(keyOf(workspaceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft>;
    return {
      text: typeof parsed.text === "string" ? parsed.text : "",
      files: Array.isArray(parsed.files) ? parsed.files : [],
    };
  } catch {
    return null;
  }
}

function write(workspaceId: string, draft: Draft) {
  try {
    if (!draft.text && draft.files.length === 0) {
      window.localStorage.removeItem(keyOf(workspaceId));
    } else {
      window.localStorage.setItem(keyOf(workspaceId), JSON.stringify(draft));
    }
  } catch {
    /* Storage unavailable — see the header. */
  }
}

export function useChatDraft(
  workspaceId: string,
  draft: Draft,
  restore: (draft: Draft) => void,
) {
  /* Nothing is written until the stored draft has been read back, or the
     first render's empty box would overwrite it. */
  const restored = useRef(false);
  const restoreRef = useRef(restore);
  useEffect(() => {
    restoreRef.current = restore;
  });

  /* Always restores, even to empty: switching workspace must not carry one
     channel's half-written message into the next. */
  useEffect(() => {
    restoreRef.current(read(workspaceId) ?? { text: "", files: [] });
    restored.current = true;
  }, [workspaceId]);

  /* Debounced: this runs on every keystroke, and storage is synchronous. */
  const { text, files } = draft;
  useEffect(() => {
    if (!restored.current) return;
    const timer = setTimeout(() => write(workspaceId, { text, files }), 300);
    return () => clearTimeout(timer);
  }, [workspaceId, text, files]);
}
