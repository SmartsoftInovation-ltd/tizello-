"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  attachChatListeners,
  createChatSocket,
  type ChatError,
} from "@/components/chat/chat-socket-events";
import { loadMessagesAction } from "@/lib/actions/chat-actions";
import {
  appendMessage,
  dropPending,
  mergeOlder,
  optimisticMessage,
  replaceMessage,
  tombstoneMessage,
} from "@/lib/chat-messages";
import type {
  ChatMessage,
  ChatPresence,
  ChatSender,
  ChatTarget,
} from "@/types/chat";

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

export function useChatSocket(target: ChatTarget, viewer: ChatSender | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presence, setPresence] = useState<ChatPresence[]>([]);
  const [typing, setTyping] = useState<ChatPresence[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  /* Learned from the join's ack. Every event after the join names the channel
     by this id — the server re-proves access on each one, so holding it is not
     holding a permission. */
  const [channelId, setChannelId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const authFailures = useRef(0);

  /* The first page is read through a Server Action rather than fetched here:
     the API cookie is httpOnly and same-origin, so the browser has no
     credential to send it directly. See `lib/actions/chat-actions.ts`. */
  /* A target is an object literal at the call site, so it is a new reference on
     every render. Serialising it is what keeps the effects below from tearing
     the socket down and rebuilding it sixty times a second. */
  const targetKey = JSON.stringify(target);

  useEffect(() => {
    let live = true;

    loadMessagesAction(JSON.parse(targetKey)).then((page) => {
      if (!live) return;
      setMessages((held) => mergeOlder(held, page.messages));
      setCursor(page.nextCursor);
      setReady(true);
    });

    return () => {
      live = false;
    };
  }, [targetKey]);

  useEffect(() => {
    const socket: Socket = createChatSocket();

    socketRef.current = socket;

    /* Re-joined on every connect, not just the first: a reconnect is a new
       socket to the server, so its room membership has to be proved again —
       and a person removed from the workspace between two connects is refused
       here rather than silently kept in the room. */
    const join = () => {
      authFailures.current = 0;
      socket.emit(
        "channel:join",
        JSON.parse(targetKey),
        (ack: { channelId?: string; users?: ChatPresence[] } | undefined) => {
          setChannelId(ack?.channelId ?? null);
          setPresence(ack?.users ?? []);
        },
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
        setTyping((held) => {
          const without = held.filter((who) => who.id !== userId);

          return typing
            ? [...without, { id: userId, name, email: "", avatarUrl: null }]
            : without;
        }),
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
  }, [targetKey]);

  const send = useCallback(
    (content: string) => {
      if (!channelId) return;

      const clientId = crypto.randomUUID();

      setError(null);
      setMessages((held) =>
        appendMessage(held, optimisticMessage(channelId, clientId, content, viewer)),
      );

      socketRef.current?.emit(
        "message:send",
        { channelId, content, clientId },
        (ack: { message?: ChatMessage } | undefined) => {
          /* No ack means the send was refused — `chat:error` carries the
             reason, and the bubble has to go rather than sit there looking
             sent. */
          if (!ack?.message) setMessages((held) => dropPending(held, clientId));
        },
      );
    },
    [channelId, viewer],
  );

  const edit = useCallback((messageId: string, content: string) => {
    socketRef.current?.emit("message:edit", { messageId, content });
  }, []);

  const remove = useCallback((messageId: string) => {
    socketRef.current?.emit("message:delete", { messageId });
  }, []);

  const signalTyping = useCallback(
    (active: boolean) => {
      if (!channelId) return;

      socketRef.current?.emit(active ? "typing:start" : "typing:stop", { channelId });
    },
    [channelId],
  );

  const loadOlder = useCallback(async () => {
    if (!cursor) return;

    const page = await loadMessagesAction(JSON.parse(targetKey), cursor);
    setMessages((held) => mergeOlder(held, page.messages));
    setCursor(page.nextCursor);
  }, [cursor, targetKey]);

  return {
    channelId,
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
