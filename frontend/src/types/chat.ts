/*
 * A chat message as the API returns it — `backend/docs/api/chat.md` §4.
 *
 * `content` is `null` exactly when `deleted` is true: a removed message keeps
 * its row so a reply quoting it does not dangle, and the server's DTO drops
 * the text rather than trusting a client to hide it. Render the tombstone,
 * never the text.
 *
 * `sender` is `null` for a departed member. `Message.senderId` is `SetNull`
 * because a channel is the record of a conversation, so the row outlives the
 * account — every renderer has to handle the missing person.
 */

export type ChatSender = {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
};

export type ChatMessage = {
  id: string;
  workspaceId: string;
  content: string | null;
  deleted: boolean;
  editedAt: string | null;
  createdAt: string;
  sender: ChatSender | null;
  /**
   * The sender's own optimistic id, echoed back on the broadcast and never
   * stored. Present only on a live `message:new`, which is why it is optional:
   * a message loaded from history has nothing to reconcile with.
   */
  clientId?: string | null;
};

/**
 * One page of history, newest first. `nextCursor` is opaque — it encodes
 * `(createdAt, id)` because two messages can share a millisecond — so it is
 * echoed back untouched and never parsed here.
 */
export type ChatPage = {
  messages: ChatMessage[];
  nextCursor: string | null;
};

/** Who is currently connected to a channel, deduplicated by person. */
export type ChatPresence = ChatSender;
