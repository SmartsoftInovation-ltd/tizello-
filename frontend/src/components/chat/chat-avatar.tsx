"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarTone } from "@/lib/chat-colors";
import type { ChatSender } from "@/types/chat";

/*
 * The disc beside a message: the sender's initial on their own colour.
 *
 * The colour table and the argument for it live in `lib/chat-colors.ts`, which
 * the header's presence faces read too — one person, one hue, everywhere.
 */

export function ChatAvatar({
  sender,
  isOwn = false,
}: {
  sender: ChatSender | null;
  /** The reader's own disc takes the brand tint — see below. */
  isOwn?: boolean;
}) {
  /* THE ONLY PLACE A NAME IS RENDERED now that the bubble has no name row, so
     it falls back the way the rest of the app does: the local part of the
     address for an account that never set a name, never the whole address. */
  const label = sender
    ? (sender.name ?? sender.email.split("@")[0])
    : "Deleted user";

  /* YOUR OWN DISC IS BRAND-TINTED, not hashed. The hues exist to tell other
     people apart from each other; you are never the person the reader is
     trying to identify, and a random hue beside your own green bubble fights
     it for no gain. */
  const tone = !sender
    ? "bg-chip text-text-subtle"
    : isOwn
      ? "bg-brand-200 text-brand-900"
      : avatarTone(sender.id);

  return (
    <Avatar title={label} className={`size-7 text-2xs font-semibold ${tone}`}>
      <AvatarFallback aria-hidden="true">
        {label.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}
