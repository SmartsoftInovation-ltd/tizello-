"use client";

import {
  MoreGlyph,
  PhoneGlyph,
  SearchGlyph,
  VideoGlyph,
} from "@/components/chat/chat-icons";
import { LockedControl } from "@/components/ui/locked-control";

/*
 * The header's chip row: search, call, video, more.
 *
 * **EVERY ONE OF THEM IS INERT, AND SAYS SO.** None of these exists yet — the
 * API has no message search, no calls and no per-channel settings — so they
 * are `LockedControl`s: a tooltip, an accessible name that ends in the reason,
 * and the dim. That is this codebase's own pattern for a control that is
 * designed and not built (`ui/locked-control.tsx`), and it is the difference
 * between a screen that admits what it cannot do and one that silently
 * swallows clicks.
 *
 * SEARCH IS LOCKED TOO, which is worth saying because the app HAS a search:
 * ⌘K looks through tasks, projects and sprints, and finds no messages at all.
 * Wiring this to it would answer a different question from the one the icon
 * asks while sitting in a chat header.
 *
 * The divider before `more` is the mockup's, and it earns its place: the first
 * three act on the conversation, the last one is about the channel.
 */

const CHIP =
  "size-8 rounded-full bg-surface-sunken text-text-muted transition-colors duration-100 ease-standard";

export function ChatHeaderActions() {
  return (
    <div className="flex items-center gap-1.5">
      <LockedControl
        label="Search this channel"
        reason="Message search is not built yet"
        className={CHIP}
      >
        <SearchGlyph />
      </LockedControl>

      <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />

      <LockedControl
        label="Start a voice call"
        reason="Calls are not built yet"
        className={CHIP}
      >
        <PhoneGlyph />
      </LockedControl>

      <LockedControl
        label="Start a video call"
        reason="Calls are not built yet"
        className={CHIP}
      >
        <VideoGlyph />
      </LockedControl>

      <LockedControl
        label="Channel options"
        reason="Channel options are not built yet"
        className={CHIP}
      >
        <MoreGlyph />
      </LockedControl>
    </div>
  );
}
