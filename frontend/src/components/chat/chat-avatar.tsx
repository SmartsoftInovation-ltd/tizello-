"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarTone } from "@/lib/chat-colors";
import { avatarSrc, displayName } from "@/lib/profile-display";
import type { ChatSender } from "@/types/chat";

/*
 * The disc beside a message: the sender's PHOTO when they have one, their
 * initial on their own colour when they do not.
 *
 * The photo is the same one the profile screen shows, resolved by
 * `lib/profile.ts#avatarSrc` — the row stores a path, not a URL, so the origin
 * is this deploy's `NEXT_PUBLIC_UPLOADS_URL` rather than whatever origin
 * happened to be current when the file was uploaded. A missing or unreachable
 * file falls back to the initial on its own, because `AvatarImage` is a layer
 * ON TOP of the fallback rather than a replacement for it.
 *
 * The colour table and the argument for it live in `lib/chat-colors.ts`, which
 * the header's presence faces read too — one person, one hue, everywhere.
 */

export function ChatAvatar({
  sender,
  isOwn = false,
  className = "size-7",
}: {
  sender: ChatSender | null;
  /** The reader's own disc takes the brand tint — see below. */
  isOwn?: boolean;
  /** Size and any ring. The header's presence faces are smaller than the thread's. */
  className?: string;
}) {
  /* THE ONLY PLACE A NAME IS RENDERED now that the bubble has no name row, so
     it uses the app's own precedence — nickname, then full name, then the
     address's local part, never the whole address. */
  const label = sender ? displayName(sender) : "Deleted user";
  const photo = sender ? avatarSrc(sender.avatarUrl) : null;

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
    <Avatar title={label} className={`${className} text-2xs font-semibold ${tone}`}>
      <AvatarFallback aria-hidden="true">
        {label.charAt(0).toUpperCase()}
      </AvatarFallback>
      {photo && <AvatarImage src={photo} alt={`${label}'s profile photo`} />}
    </Avatar>
  );
}
