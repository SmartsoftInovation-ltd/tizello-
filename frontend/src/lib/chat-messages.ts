import type { ChatMessage } from "@/types/chat";

/*
 * The list arithmetic behind a live channel, kept pure and out of the socket
 * hook — every one of these is a decision about what the reader sees when two
 * sources disagree, and none of them needs React to be tested.
 *
 * **The list is held OLDEST FIRST**, the opposite of the API's page, because
 * that is the order it is read in and the order a scroll container appends to.
 * `mergeOlder` is where the reversal happens, so nothing else has to think
 * about it.
 */

/** Newest last. The API pages newest-first; a rendered channel reads downward. */
const byTime = (a: ChatMessage, b: ChatMessage) =>
  a.createdAt === b.createdAt
    ? a.id.localeCompare(b.id)
    : a.createdAt.localeCompare(b.createdAt);

/**
 * Adds a live message, and de-duplicates it two ways.
 *
 * BY ID, because a reconnect re-reads history that may already contain it, and
 * BY `clientId`, because the sender drew an optimistic bubble the moment they
 * pressed Enter and the broadcast that comes back is the same message. Without
 * the second check every message you send appears twice on your own screen —
 * which is the entire reason the server echoes `clientId` at all.
 */
export function appendMessage(
  list: ChatMessage[],
  message: ChatMessage,
): ChatMessage[] {
  const next = list.filter(
    (row) =>
      row.id !== message.id &&
      !(message.clientId && row.id === `pending:${message.clientId}`),
  );

  return [...next, message].sort(byTime);
}

/** An edit, or a deletion the server has confirmed. Unknown id: ignored —
 *  a message this tab never loaded is one it has nothing to update. */
export function replaceMessage(
  list: ChatMessage[],
  message: ChatMessage,
): ChatMessage[] {
  return list.map((row) => (row.id === message.id ? message : row));
}

/**
 * Tombstones a message from a `message:deleted` broadcast, which carries only
 * the id.
 *
 * The row is kept and emptied rather than removed, matching what history
 * returns: a channel where a deletion makes a message vanish from one screen
 * and leave a "deleted" line on another is two clients telling different
 * stories about the same conversation.
 */
export function tombstoneMessage(
  list: ChatMessage[],
  id: string,
): ChatMessage[] {
  return list.map((row) =>
    row.id === id ? { ...row, content: null, deleted: true } : row,
  );
}

/**
 * Prepends an older page, dropping anything already held.
 *
 * The overlap is real rather than defensive: a message can arrive live while
 * the request for the page above it is in flight, and it would then be in both
 * the page and the list.
 */
export function mergeOlder(
  list: ChatMessage[],
  page: ChatMessage[],
): ChatMessage[] {
  const held = new Set(list.map((row) => row.id));

  return [...page.filter((row) => !held.has(row.id)), ...list].sort(byTime);
}

/**
 * The bubble drawn the instant Enter is pressed, before the server has
 * answered.
 *
 * Its id is `pending:<clientId>` so it can never collide with a real cuid, and
 * so `appendMessage` can find and replace it when the broadcast arrives. It is
 * marked `pending` for the renderer to dim — a message that looks identical to
 * a saved one is a message the reader believes was delivered when it may not
 * have been.
 */
export function optimisticMessage(
  channelId: string,
  clientId: string,
  content: string,
  sender: ChatMessage["sender"],
): ChatMessage {
  return {
    id: `pending:${clientId}`,
    channelId,
    content,
    deleted: false,
    editedAt: null,
    createdAt: new Date().toISOString(),
    sender,
    clientId,
  };
}

/** A pending bubble the server never confirmed — see `optimisticMessage`. */
export const isPending = (message: ChatMessage) =>
  message.id.startsWith("pending:");

/** Drops an optimistic bubble whose send was refused. */
export function dropPending(
  list: ChatMessage[],
  clientId: string,
): ChatMessage[] {
  return list.filter((row) => row.id !== `pending:${clientId}`);
}
