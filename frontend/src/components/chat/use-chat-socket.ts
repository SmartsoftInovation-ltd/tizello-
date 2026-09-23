"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  attachChatListeners,
  createChatSocket,
  type ChatError,
} from "@/components/chat/chat-socket-events";
import { loadMessagesAction } from "@/lib/actions/chat-actions";
import { useChatActions } from "@/components/chat/use-chat-actions";
import { withTypist } from "@/lib/chat-typists";
import {
  appendMessage,
  mergeOlder,
  replaceMessage,
  tombstoneMessage,
} from "@/lib/chat-messages";
import type { ChatMessage, ChatPresence, ChatSender } from "@/types/chat";

/*
 * One connection to the `/chat` namespace, for as long as the panel is open.
 *
 * UNLIKE THE NOTIFICATION BELL, THIS HOLDS THE DATA. The bell treats an event
 * as a nudge and calls `router.refresh()`, which is right for a badge: one
 * fetch redraws it and there is no second source of truth. A channel cannot
 * work that way — refreshing the whole route on every keystroke-sized message
 * would re-run every Server Component on the page and still lose the scroll
 * position. So messages live in this hook, history comes from a Server Action,
 * and the two meet in `lib/chat-messages.ts`.
 *
 * AUTHENTICATION IS THE COOKIE. `withCredentials` is set and nothing here
 * touches a token: `tizello_access` is `httpOnly` precisely so page JavaScript
 * cannot read it. The server hangs up when it expires (five minutes) and the
 * reconnect carries a fresh one, because `router.refresh()` on the auth-error
 * path goes through Next's proxy, which renews the session before the render.
 *
 * See backend/docs/api/chat.md §2–3 for the event table this mirrors.
 */

const MAX_AUTH_RETRIES = 3;


export type { ChatError };

export function useChatSocket(workspaceId: string, viewer: ChatSender | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presence, setPresence] = useState<ChatPresence[]>([]);
  const [typing, setTyping] = useState<ChatPresence[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);

  const socketRef = useRef<Socket | null>(null);
  /* The current thread, for the writes that need the row they are changing —
     an edit keeps the old text so a refusal can put it back. A ref rather than
     a dependency: `edit` and `remove` must not be rebuilt on every message.
     Written in an effect, never during render: a ref assigned while rendering
     is the `react-hooks/refs` mistake, and it makes a component that reads it
     mid-render non-idempotent. */
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const authFailures = useRef(0);

  /* The first page is read through a Server Action rather than fetched here:
     the API cookie is httpOnly and same-origin, so the browser has no
     credential to send it directly. See `lib/actions/chat-actions.ts`. */
  useEffect(() => {
    let live = true;

    loadMessagesAction(workspaceId).then((page) => {
      if (!live) return;
      setMessages((held) => mergeOlder(held, page.messages));
      setCursor(page.nextCursor);
      setReady(true);
    });

    return () => {
      live = false;
    };
  }, [workspaceId]);

  useEffect(() => {
    const socket: Socket = createChatSocket();

    socketRef.current = socket;

    /* Re-joined on every connect, not just the first: a reconnect is a new
       socket to the server, so its room membership has to be proved again —
       and a person removed from the workspace between two connects is refused
       here rather than silently kept in the room. */
    const join = () => {
      authFailures.current = 0;
      /* A connection notice is stale the moment the connection is back. */
      setError((held) => (held?.code === "OFFLINE" ? null : held));
      socket.emit(
        "channel:join",
        { workspaceId },
        (ack: { users?: ChatPresence[] } | undefined) => setPresence(ack?.users ?? []),
      );
    };

    socket.on("connect", join);

    attachChatListeners(socket, {
      onMessage: (message) => {
        setMessages((held) => appendMessage(held, message));
        /* Whoever just spoke is no longer typing, whether or not their client
           remembered to say so. */
        setTyping((held) => held.filter((who) => who.id !== message.sender?.id));
      },
      onEdited: (message) => setMessages((held) => replaceMessage(held, message)),
      onDeleted: (id) => setMessages((held) => tombstoneMessage(held, id)),
      onPresence: setPresence,
      onTyping: (userId, name, typing) =>
        setTyping((held) => withTypist(held, userId, name, typing)),
      onError: setError,
    });

    socket.on("connect_error", (cause) => {
      if (cause.message !== "UNAUTHENTICATED") return;

      authFailures.current += 1;
      if (authFailures.current > MAX_AUTH_RETRIES) socket.disconnect();
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [workspaceId]);

  const { send, edit, remove, signalTyping } = useChatActions({
    socketRef,
    messagesRef,
    workspaceId,
    viewer,
    setMessages,
    setError,
  });

  const loadOlder = useCallback(async () => {
    if (!cursor) return;

    const page = await loadMessagesAction(workspaceId, cursor);
    setMessages((held) => mergeOlder(held, page.messages));
    setCursor(page.nextCursor);
  }, [cursor, workspaceId]);

  return {
    messages,
    presence,
    typing,
    ready,
    error,
    hasOlder: cursor !== null,
    send,
    edit,
    remove,
    signalTyping,
    loadOlder,
    dismissError: () => setError(null),
  };
}
