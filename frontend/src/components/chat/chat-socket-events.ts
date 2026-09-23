"use client";

import { io, type Socket } from "socket.io-client";
import type { ChatMessage, ChatPresence } from "@/types/chat";

/*
 * The `/chat` event table, in one place.
 *
 * Split out of `use-chat-socket.ts` because the hook is about a CONNECTION —
 * when it opens, when it is rejoined, what it does when the token expires —
 * and this is about a PROTOCOL: the names the server broadcasts and the shape
 * each one carries. They change for different reasons, and the split keeps a
 * new event from being a change to the reconnect logic's file.
 *
 * Mirrors backend/docs/api/chat.md §3. Every name below appears there; nothing
 * here invents one.
 */

/** The API's own origin — the browser connects to it directly, so this is public. */
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:5001";

/**
 * Opens a connection to the `/chat` namespace.
 *
 * AUTHENTICATION IS THE COOKIE, which is why `withCredentials` is set and why
 * nothing here handles a token: `tizello_access` is `httpOnly` precisely so
 * page JavaScript cannot read it.
 *
 * WEBSOCKET ONLY, as the notification bell argues: the polling fallback opens a
 * new HTTP request every few seconds against an API whose session cookie is
 * rotating, and each one is another chance to race the refresh.
 */
export const createChatSocket = (): Socket =>
  io(`${SOCKET_URL}/chat`, {
    path: "/socket.io",
    withCredentials: true,
    transports: ["websocket"],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

export type ChatError = { event: string; code: string; message: string };

/** How long a write waits for the server before the UI stops holding the door. */
const ACK_TIMEOUT_MS = 8000;

/**
 * Emits and resolves WHEN THE SERVER HAS ANSWERED — what lets a dialog hold a
 * spinner and stay open until the change is real. Emitting and closing
 * immediately is what made an edit look like it had failed: the dialog
 * vanished and the bubble kept the old text until the broadcast landed.
 *
 * A REFUSAL NEVER ACKS. The server answers `chat:error` and returns nothing,
 * so a rejected write would leave this pending forever and a spinner turning
 * after the error had already been shown. Hence the timeout, which resolves
 * `false`: the caller closes, and `chat:error` is what explains it.
 */
export function requestAck<T>(
  socket: Socket | null,
  event: string,
  payload: object,
): Promise<T | null> {
  if (!socket) return Promise.resolve(null);

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ACK_TIMEOUT_MS);

    socket.emit(event, payload, (ack: T) => {
      clearTimeout(timer);
      resolve(ack ?? null);
    });
  });
}

export type ChatHandlers = {
  onMessage: (message: ChatMessage) => void;
  onEdited: (message: ChatMessage) => void;
  onDeleted: (id: string) => void;
  onPresence: (users: ChatPresence[]) => void;
  onTyping: (userId: string, name: string | null, typing: boolean) => void;
  onError: (error: ChatError) => void;
};

/** Registers every listener and returns nothing — the caller owns teardown. */
export function attachChatListeners(socket: Socket, handlers: ChatHandlers) {
  socket.on("message:new", handlers.onMessage);
  socket.on("message:edited", handlers.onEdited);

  /* The deletion broadcast carries the id alone, not the row: a client that
     already holds the message only needs to know which one went. */
  socket.on("message:deleted", ({ id }: { id: string }) => handlers.onDeleted(id));

  socket.on("presence", ({ users }: { users: ChatPresence[] }) =>
    handlers.onPresence(users ?? []),
  );

  socket.on(
    "typing",
    (event: { userId: string; name: string | null; typing: boolean }) =>
      handlers.onTyping(event.userId, event.name, event.typing),
  );

  socket.on("chat:error", handlers.onError);
}
