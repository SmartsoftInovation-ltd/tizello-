"use client";

import type { Socket } from "socket.io-client";
import { requestAck } from "@/components/chat/chat-socket-events";
import {
  appendMessage,
  dropPending,
  optimisticMessage,
  replaceMessage,
  tombstoneMessage,
} from "@/lib/chat-messages";
import type { ChatAttachment, ChatMessage, ChatSender } from "@/types/chat";

type Setter = (update: (held: ChatMessage[]) => ChatMessage[]) => void;

/*
 * The outgoing half: send, edit, delete — each applied to the screen FIRST and
 * confirmed afterwards.
 *
 * NOTHING HERE BLOCKS THE UI. A message appears the instant it is written, an
 * edit shows the new text at once, a delete tombstones immediately, and the
 * server's answer either confirms what the reader already sees or puts it
 * back. Waiting on a round trip before showing the result is what made this
 * feel slow — over a socket the answer is fast enough to be invisible when it
 * works, and when it does not, a revert is the honest correction.
 *
 * OFFLINE IS NOT A FAILURE. Socket.IO buffers an emit made while the socket is
 * down and flushes it on reconnect — which happens on a schedule here, because
 * the access token lasts five minutes. So a send with no answer is only a
 * failure if the socket is CONNECTED; otherwise the message is queued and the
 * bubble stays where it is.
 *
 * THE SENDER RECONCILES FROM ITS OWN ACK, not from the broadcast. Waiting for
 * `message:new` looks identical most of the time and hangs forever in the
 * cases that matter: a socket that is connected but not in the room hears no
 * broadcast, and neither does one that reconnects between the emit and the
 * broadcast. The bubble then spins with no way out — which is exactly the bug
 * this file was extracted to fix. The ack is addressed to this socket alone,
 * so it always arrives, and `appendMessage` de-duplicates by id, so the
 * broadcast that follows is a no-op.
 *
 * SILENCE IS NOT A REFUSAL, and conflating them is the bug that came next. A
 * socket that is DISCONNECTED — which happens on a schedule here, because the
 * access token lasts five minutes and the server hangs up with it — buffers
 * the emit and flushes it on reconnect. The ack then arrives late, long after
 * any timeout. Treating that as a failure threw away the bubble and showed an
 * error for a message that was about to send perfectly well, which is what put
 * "You cannot do that in this channel" on screen under a thread of delivered
 * messages.
 *
 * So: no answer while CONNECTED is a failure. No answer while disconnected is
 * a wait, the bubble stays pending, and the caller is told it is a connection
 * problem rather than a permission one.
 */

/** A client id that works off localhost too — see below. */
function draftId(): string {
  /* `crypto.randomUUID` is only defined in a SECURE CONTEXT. localhost counts;
     a LAN address over plain http does not, and there it is `undefined` — which
     is exactly how a phone on the same network reaches a dev server. Throwing
     there would mean the send button silently does nothing. */
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export async function sendMessage({
  socket,
  workspaceId,
  viewer,
  content,
  attachments,
  setMessages,
  onFailed,
}: {
  socket: Socket | null;
  workspaceId: string;
  viewer: ChatSender | null;
  content: string;
  attachments: ChatAttachment[];
  setMessages: Setter;
  /** Called when the send did not land. `offline` means "not yet", not "no". */
  onFailed: (reason: "failed" | "offline") => void;
}) {
  const clientId = draftId();

  setMessages((held) =>
    appendMessage(held, optimisticMessage(workspaceId, clientId, content, viewer, attachments)),
  );

  const ack = await requestAck<{ message: ChatMessage }>(socket, "message:send", {
    workspaceId,
    content,
    attachments,
    clientId,
  });

  if (ack?.message) {
    setMessages((held) => appendMessage(held, { ...ack.message, clientId }));
    return;
  }

  /* Nothing came back. If the socket is down the emit is buffered and will
     flush on reconnect, so the bubble STAYS — dropping it would delete a
     message the server is about to receive. */
  if (!socket?.connected) return onFailed("offline");

  /* Connected and still silent: refused (`chat:error` usually explains it) or
     genuinely lost. Either way the bubble has to go rather than sit there
     looking sent. */
  setMessages((held) => dropPending(held, clientId));
  onFailed("failed");
}

/**
 * Edits a message on screen, then tells the server.
 *
 * The old text is kept so a refusal can put it back — which is the whole cost
 * of showing the change immediately, and it is cheaper than making everybody
 * watch a spinner for the case that almost never happens.
 */
export async function editMessage({
  socket,
  message,
  content,
  setMessages,
  onFailed,
}: {
  socket: Socket | null;
  message: ChatMessage;
  content: string;
  setMessages: Setter;
  onFailed: (reason: "failed" | "offline") => void;
}) {
  const previous = message.content;

  setMessages((held) =>
    replaceMessage(held, { ...message, content, editedAt: new Date().toISOString() }),
  );

  const ack = await requestAck<{ message: ChatMessage }>(socket, "message:edit", {
    messageId: message.id,
    content,
  });

  if (ack?.message) return setMessages((held) => replaceMessage(held, ack.message));
  if (!socket?.connected) return onFailed("offline");

  setMessages((held) => replaceMessage(held, { ...message, content: previous }));
  onFailed("failed");
}

/**
 * Tombstones a message on screen, then tells the server.
 *
 * The revert restores the whole row rather than a flag: `tombstoneMessage`
 * empties the content as well, and putting back only `deleted: false` would
 * leave a message with no words in it.
 */
export async function deleteMessage({
  socket,
  message,
  setMessages,
  onFailed,
}: {
  socket: Socket | null;
  message: ChatMessage;
  setMessages: Setter;
  onFailed: (reason: "failed" | "offline") => void;
}) {
  setMessages((held) => tombstoneMessage(held, message.id));

  const ack = await requestAck(socket, "message:delete", { messageId: message.id });

  if (ack) return;
  if (!socket?.connected) return onFailed("offline");

  setMessages((held) => replaceMessage(held, message));
  onFailed("failed");
}
