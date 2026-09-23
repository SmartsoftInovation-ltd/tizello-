"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { Socket } from "socket.io-client";
import {
  deleteMessage,
  editMessage,
  sendMessage,
} from "@/components/chat/chat-send";
import type { ChatError } from "@/components/chat/chat-socket-events";
import type { ChatAttachment, ChatMessage, ChatSender } from "@/types/chat";

/*
 * The four things a reader DOES in a channel: send, edit, delete, and say they
 * are typing.
 *
 * Split from `use-chat-socket.ts`, which owns the CONNECTION — when it opens,
 * when it rejoins, what happens when the token expires. These are the writes
 * over it, and they change for different reasons.
 *
 * NONE OF THEM RETURNS ANYTHING TO WAIT ON. Every one applies to the screen
 * first and confirms afterwards (`chat-send.ts`), so a caller closes its dialog
 * immediately — there is nothing left to watch. The failure path is a notice,
 * not a spinner.
 */

/** What the notice strip shows when a write does not land. */
const failure = (event: string, reason: "failed" | "offline"): ChatError => ({
  event,
  /* This client\u2019s own code, not the API\u2019s: nothing refused anything, the
     connection is simply down and the emit is queued. `chat-notice.tsx` treats
     it as news rather than as an error. */
  code: reason === "offline" ? "OFFLINE" : "SERVER_ERROR",
  message: reason === "offline" ? "Waiting for the connection" : "That did not go through",
});

export function useChatActions({
  socketRef,
  messagesRef,
  workspaceId,
  viewer,
  setMessages,
  setError,
}: {
  socketRef: React.RefObject<Socket | null>;
  /** The current thread, for the writes that need the row they are changing. */
  messagesRef: React.RefObject<ChatMessage[]>;
  workspaceId: string;
  viewer: ChatSender | null;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setError: Dispatch<SetStateAction<ChatError | null>>;
}) {
  const send = useCallback(
    (content: string, attachments: ChatAttachment[] = []) => {
      setError(null);

      return sendMessage({
        socket: socketRef.current,
        workspaceId,
        viewer,
        content,
        attachments,
        setMessages,
        onFailed: (reason) =>
          setError((held) => held ?? failure("message:send", reason)),
      });
    },
    [socketRef, workspaceId, viewer, setMessages, setError],
  );

  const edit = useCallback(
    (messageId: string, content: string) => {
      const message = messagesRef.current.find((row) => row.id === messageId);
      if (!message) return;

      setError(null);
      void editMessage({
        socket: socketRef.current,
        message,
        content,
        setMessages,
        onFailed: (reason) => setError(failure("message:edit", reason)),
      });
    },
    [socketRef, messagesRef, setMessages, setError],
  );

  const remove = useCallback(
    (messageId: string) => {
      const message = messagesRef.current.find((row) => row.id === messageId);
      if (!message) return;

      setError(null);
      void deleteMessage({
        socket: socketRef.current,
        message,
        setMessages,
        onFailed: (reason) => setError(failure("message:delete", reason)),
      });
    },
    [socketRef, messagesRef, setMessages, setError],
  );

  const signalTyping = useCallback(
    (active: boolean) => {
      socketRef.current?.emit(active ? "typing:start" : "typing:stop", { workspaceId });
    },
    [socketRef, workspaceId],
  );

  return { send, edit, remove, signalTyping };
}
