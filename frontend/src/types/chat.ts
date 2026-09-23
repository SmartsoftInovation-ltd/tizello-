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
  /** What they chose to be called. Preferred over `name` wherever one word fits. */
  nickname: string | null;
  email: string;
  /** A stored PATH (`/uploads/<name>`), not a URL — `lib/profile.ts#avatarSrc`
   *  joins it onto this deploy's uploads origin. */
  avatarUrl: string | null;
};

/**
 * A file sent with a message — exactly what `POST /uploads` answered for it.
 *
 * Stored as JSON on the message rather than in a table of its own: nothing
 * queries inside it and every read wants the whole array. `url` is the API's
 * path (`/uploads/<storedName>`), which `lib/uploads.ts#uploadUrl` joins onto
 * this deploy's origin — the row must not carry one.
 */
export type ChatAttachment = {
  id: string;
  name: string;
  storedName: string;
  url: string;
  size: number;
  mime: string;
};

export type ChatMessage = {
  id: string;
  workspaceId: string;
  content: string | null;
  deleted: boolean;
  /** Empty for a text-only message, and always empty on a tombstone. */
  attachments: ChatAttachment[];
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

/** A workspace with unread chat, for the bell — `GET /chat/unread`. */
export type ChatUnread = {
  workspaceId: string;
  name: string;
  icon: string | null;
  count: number;
};
