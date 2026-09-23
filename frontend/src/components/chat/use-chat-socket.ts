"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { loadMessagesAction } from "@/lib/actions/chat-actions";
import {
  appendMessage,
  dropPending,
  mergeOlder,
  optimisticMessage,
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

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:5001";

const MAX_AUTH_RETRIES = 3;

export type ChatError = { event: string; code: string; message: string };

export function useChatSocket(projectId: string, viewer: ChatSender | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presence, setPresence] = useState<ChatPresence[]>([]);
  const [typing, setTyping] = useState<ChatPresence[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const authFailures = useRef(0);

  /* The first page is read through a Server Action rather than fetched here:
     the API cookie is httpOnly and same-origin, so the browser has no
     credential to send it directly. See `lib/actions/chat-actions.ts`. */
  useEffect(() => {
    let live = true;

    loadMessagesAction(projectId).then((page) => {
      if (!live) return;
      setMessages((held) => mergeOlder(held, page.messages));
      setCursor(page.nextCursor);
      setReady(true);
    });

    return () => {
      live = false;
    };
  }, [projectId]);

  useEffect(() => {
    const socket: Socket = io(`${SOCKET_URL}/chat`, {
      path: "/socket.io",
      withCredentials: true,
      /* WebSocket only, as the bell argues: the polling fallback opens a new
         HTTP request every few seconds against an API whose session cookie is
         rotating, and each one is another chance to race the refresh. */
      transports: ["websocket"],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;

    /* Re-joined on every connect, not just the first: a reconnect is a new
       socket to the server, so its room membership has to be proved again. */
    const join = () => {
      authFailures.current = 0;
      socket.emit("channel:join", { projectId }, (ack: { users?: ChatPresence[] }) => {
        setPresence(ack?.users ?? []);
      });
    };

    socket.on("connect", join);

    socket.on("message:new", (message: ChatMessage) => {
      setMessages((held) => appendMessage(held, message));
      setTyping((held) => held.filter((who) => who.id !== message.sender?.id));
    });

    socket.on("message:edited", (message: ChatMessage) => {
      setMessages((held) => replaceMessage(held, message));
    });

    socket.on("message:deleted", ({ id }: { id: string }) => {
      setMessages((held) => tombstoneMessage(held, id));
    });

    socket.on("presence", ({ users }: { users: ChatPresence[] }) => {
      setPresence(users ?? []);
    });

    socket.on(
      "typing",
      (event: { userId: string; name: string | null; typing: boolean }) => {
        setTyping((held) => {
          const without = held.filter((who) => who.id !== event.userId);
          if (!event.typing) return without;

          return [
            ...without,
            { id: event.userId, name: event.name, email: "", avatarUrl: null },
          ];
        });
      },
    );

    socket.on("chat:error", (payload: ChatError) => {
      setError(payload);
    });

    socket.on("connect_error", (cause) => {
      if (cause.message !== "UNAUTHENTICATED") return;

      authFailures.current += 1;
      if (authFailures.current > MAX_AUTH_RETRIES) socket.disconnect();
    });

    return () => {
      socket.emit("channel:leave", { projectId });
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [projectId]);

  const send = useCallback(
    (content: string) => {
      const clientId = crypto.randomUUID();

      setError(null);
      setMessages((held) =>
        appendMessage(held, optimisticMessage(projectId, clientId, content, viewer)),
      );

      socketRef.current?.emit(
        "message:send",
        { projectId, content, clientId },
        (ack: { message?: ChatMessage } | undefined) => {
          /* No ack means the send was refused — `chat:error` carries the
             reason, and the bubble has to go rather than sit there looking
             sent. */
          if (!ack?.message) setMessages((held) => dropPending(held, clientId));
        },
      );
    },
    [projectId, viewer],
  );

  const edit = useCallback((messageId: string, content: string) => {
    socketRef.current?.emit("message:edit", { messageId, content });
  }, []);

  const remove = useCallback((messageId: string) => {
    socketRef.current?.emit("message:delete", { messageId });
  }, []);

  const signalTyping = useCallback(
    (active: boolean) => {
      socketRef.current?.emit(active ? "typing:start" : "typing:stop", { projectId });
    },
    [projectId],
  );

  const loadOlder = useCallback(async () => {
    if (!cursor) return;

    const page = await loadMessagesAction(projectId, cursor);
    setMessages((held) => mergeOlder(held, page.messages));
    setCursor(page.nextCursor);
  }, [cursor, projectId]);

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
