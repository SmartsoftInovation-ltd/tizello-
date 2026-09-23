"use client";

import { cn } from "@/lib/cn";
import type { ChatError } from "@/components/chat/chat-socket-events";

/*
 * The strip under the header that says what just went wrong.
 *
 * ONE SENTENCE PER CODE, and a catch-all that admits it does not know. The
 * previous version had two branches and an `else` reading "You cannot do that
 * in this channel", which every unknown code fell into — including this
 * client's own "no answer yet". A thread of delivered messages under a
 * permission error is a worse bug than the thing it was reporting, because it
 * sends the reader looking for a problem that is not there.
 *
 * THE SERVER'S OWN SENTENCE IS STILL NOT RENDERED. `code` is what the UI
 * branches on, exactly as the REST half does, so a backend wording change
 * cannot leak into the page. The code IS shown, small and last: it costs a
 * word and it is the difference between a bug report that says "it showed an
 * error" and one that says which.
 *
 * A CONNECTION NOTICE IS NOT AN ERROR. `OFFLINE` is this client's own code for
 * "the socket is down, your message is queued", so it gets the warning tint and
 * no Dismiss — it clears itself the moment the socket rejoins.
 */

const COPY: Record<string, string> = {
  OFFLINE: "Connection lost — your message will send when it is back.",
  RATE_LIMITED: "You are sending messages too quickly. Wait a moment.",
  VALIDATION_ERROR: "That message could not be sent — check its length and files.",
  FORBIDDEN: "Only the author can edit or delete a message.",
  NOT_FOUND: "That message is no longer here.",
  SERVER_ERROR: "The message did not send. Try again.",
};

export function ChatNotice({
  error,
  onDismiss,
}: {
  error: ChatError | null;
  onDismiss: () => void;
}) {
  if (!error) return null;

  const offline = error.code === "OFFLINE";

  return (
    <p
      role="status"
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2 text-2xs text-text-muted",
        offline ? "bg-warning-subtle" : "bg-danger-subtle",
      )}
    >
      <span>
        {COPY[error.code] ?? "Something went wrong."}{" "}
        <span className="text-text-subtle">({error.code})</span>
      </span>

      {!offline && (
        <button type="button" onClick={onDismiss} className="shrink-0 underline">
          Dismiss
        </button>
      )}
    </p>
  );
}
