/**
 * Chat's business rules — ALL of them, for both transports.
 *
 * The REST controller and the `/chat` socket namespace are two doors into this
 * file. Neither holds a permission rule: a rule enforced on one and forgotten
 * on the other is the likeliest way this feature leaks a conversation, and the
 * only defence that scales is having one place where the rules are.
 *
 * **ONE CHANNEL PER WORKSPACE, AND EVERY MEMBER IS IN IT.** That is the whole
 * access model — there is no per-project chat, no narrower tier, and no wider
 * one: **a message belongs to whoever wrote it**, so only its author may edit
 * or delete it, workspace OWNER included. See `deleteMessage` for what that
 * costs and how to put moderation back.
 *
 * **PERSIST, THEN BROADCAST.** `sendMessage` returns a saved row and never
 * emits; the namespace emits what it returns. Broadcast-first is faster and
 * wrong — a failed insert leaves a message on every screen in the room that no
 * history load will ever return.
 *
 * **THE SENDER IS THE CALLER.** Every write takes a `userId` resolved from the
 * session — `req.user.id` or `socket.data.userId` — and the payload's own
 * `senderId` is rejected by the validator before it reaches here.
 *
 * Throws `AppError` with an `AUTH_CODES` code, never touches `res`, never
 * imports Prisma.
 *
 * See docs/api/chat.md and .claude/plan/chat.md
 */

import repository from './chat.repository.js';
import dto from './chat.dto.js';
import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import { AUTH_CODES } from '../../shared/constants/authCodes.js';
import { resolveWorkspaceAccess } from '../../shared/services/workspace-access.js';

/* A channel nobody may see and a workspace that does not exist are one answer.
   Confirming a workspace exists to somebody with no access to it is itself the
   leak — the same rule `loadMembership` applies. */
const notFound = (what = 'Channel') =>
  new AppError(httpStatus.NOT_FOUND, `${what} not found`, AUTH_CODES.NOT_FOUND);

const forbidden = (message) =>
  new AppError(httpStatus.FORBIDDEN, message, AUTH_CODES.FORBIDDEN);

/**
 * Resolves a workspace to a channel the caller may use, or throws.
 *
 * Every member, with no further test — that is what a workspace channel is
 * for. The refusal is `404`, never `403`: a `403` would confirm the
 * conversation exists to somebody with no access to it.
 *
 * Returns the workspace plus `canModerate` — OWNER or ADMIN. **Nothing in this
 * module reads it any more** now that deletion is author-only; it is kept
 * because it is the flag moderation would come back through, and because
 * `workspace-access.js` computes it for callers generally.
 */
const requireChannel = async (userId, workspaceId) => {
  const access = await resolveWorkspaceAccess(userId, workspaceId);

  if (!access) throw notFound();

  return { workspace: access.workspace, canModerate: access.canModerate };
};

/* --- reads -------------------------------------------------------------- */

/**
 * One page of history, newest first.
 *
 * `nextCursor` is null at the beginning of the channel, and specifically when
 * the page came back shorter than `limit` — a client that keeps asking after
 * that is paging past the start.
 */
const listMessages = async (userId, workspaceId, { limit, cursor } = {}) => {
  await requireChannel(userId, workspaceId);

  const decoded = cursor ? dto.decodeCursor(cursor) : null;

  /* A cursor the server did not write. `VALIDATION_ERROR`, never a silent
     first page: a client that believes it is paging while re-reading the head
     loops forever, and the bug looks like a rendering problem. */
  if (cursor && !decoded) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid cursor', AUTH_CODES.VALIDATION_ERROR, [
      { field: 'cursor', message: 'cursor is not a valid page position' },
    ]);
  }

  const rows = await repository.findMessages({ workspaceId, limit, cursor: decoded });

  return {
    messages: rows.map(dto.toMessage),
    nextCursor: rows.length === limit ? dto.encodeCursor(rows[rows.length - 1]) : null,
  };
};

const getUnreadCount = async (userId, workspaceId) => {
  await requireChannel(userId, workspaceId);

  const state = await repository.findReadState(userId, workspaceId);

  return repository.countUnread({
    workspaceId,
    userId,
    lastReadAt: state?.lastReadAt ?? null,
  });
};

/**
 * The bell's view of chat: every workspace the caller belongs to that has
 * unread messages, with the count. Workspaces with nothing unread are left
 * out, so an empty array means "nothing new anywhere".
 *
 * No `requireChannel` — the list is built FROM the caller's memberships, so
 * it cannot name a workspace they are not in.
 */
const getUnreadSummary = async (userId) => {
  const memberships = await repository.findMembershipsWithReadState(userId);

  const rows = await Promise.all(
    memberships.map(async ({ workspace }) => ({
      workspaceId: workspace.id,
      name: workspace.name,
      icon: workspace.icon,
      count: await repository.countUnread({
        workspaceId: workspace.id,
        userId,
        lastReadAt: workspace.messageReads[0]?.lastReadAt ?? null,
      }),
    }))
  );

  return rows.filter((row) => row.count > 0);
};

/** Who a new message in this workspace should nudge: every member but the sender. */
const recipientsOf = (workspaceId, senderId) => repository.findMemberIds(workspaceId, senderId);

/* --- watermark ---------------------------------------------------------- */

/**
 * Moves the caller's read watermark, idempotently.
 *
 * **IT NEVER MOVES BACKWARDS.** A late request from a tab that was behind must
 * not un-read what another tab already read, so the stored value wins whenever
 * it is the later of the two. That is also why this is a timestamp rather than
 * a counter: two tabs racing on a counter disagree, two racing on
 * `max(stored, incoming)` cannot.
 *
 * A future `at` is clamped to now. Without the clamp one request marks the
 * channel unread-proof forever, including for messages nobody has written yet.
 */
const markRead = async (userId, workspaceId, { at } = {}) => {
  await requireChannel(userId, workspaceId);

  const now = new Date();
  const requested = at ? new Date(at) : now;
  const clamped = requested > now ? now : requested;

  const state = await repository.findReadState(userId, workspaceId);
  const next = state && state.lastReadAt > clamped ? state.lastReadAt : clamped;

  const row = await repository.upsertRead({ userId, workspaceId, at: next });

  return { lastReadAt: row.lastReadAt };
};

/* --- writes ------------------------------------------------------------- */

/**
 * Writes a message and returns it. Broadcasting is the caller's job.
 *
 * **Membership is re-checked here, not trusted from the socket's earlier
 * join.** Join-only would leave somebody removed from the workspace
 * mid-session writing into it until they refreshed. It is one indexed lookup
 * against a channel that is not high-throughput.
 */
const sendMessage = async (userId, workspaceId, { content, attachments }) => {
  await requireChannel(userId, workspaceId);

  const row = await repository.createMessage({
    workspaceId,
    senderId: userId,
    content,
    attachments,
  });

  return dto.toMessage(row);
};

/**
 * Loads a message and the caller's standing in its channel, or throws.
 *
 * The `404` for a message in a workspace the caller is not in is the same
 * `404` as an id that never existed — otherwise the endpoint is an oracle for
 * "is this id live somewhere I have no access to".
 */
const loadForWrite = async (userId, messageId) => {
  const message = await repository.findMessageById(messageId);
  if (!message) throw notFound('Message');

  const access = await resolveWorkspaceAccess(userId, message.workspaceId);
  if (!access) throw notFound('Message');

  return { message, canModerate: access.canModerate };

};

/**
 * Edits a message. **The author only, with no escape hatch.**
 *
 * An admin who can rewrite somebody's words is a worse property than an admin
 * who cannot remove them — a deletion is visible to everyone in the room, an
 * edit is not. So this tier is deliberately narrower than `deleteMessage`'s.
 *
 * Editing a deleted message is `404`, not a resurrection: the tombstone is a
 * record that something was removed, and writing new text into it would make
 * that record a lie.
 */
const editMessage = async (userId, { messageId, content }) => {
  const { message } = await loadForWrite(userId, messageId);

  if (message.deletedAt) throw notFound('Message');
  if (message.senderId !== userId) throw forbidden('Only the author can edit a message');

  return dto.toMessage(await repository.updateMessage(messageId, content));
};

/**
 * Soft-deletes a message. **THE AUTHOR ONLY.**
 *
 * Deletion used to admit a workspace OWNER/ADMIN as well, on the argument that
 * somebody has to be able to remove an abusive message. That escape hatch is
 * gone at the product's request: what you said is yours, and nobody else edits
 * or removes it.
 *
 * **The consequence is real and should be known:** there is now no way to take
 * a message down except as its author. If moderation is wanted back, this is
 * the one branch to restore — `resolveWorkspaceAccess` still computes
 * `canModerate` for exactly that, and it is still what the UI would draw a
 * control from.
 *
 * Deleting an already-deleted message returns the tombstone rather than a
 * `409`: a double-click is not a conflict anybody can act on, and the second
 * click's answer is the state they wanted.
 */
const deleteMessage = async (userId, { messageId }) => {
  const { message } = await loadForWrite(userId, messageId);

  if (message.senderId !== userId) {
    throw forbidden('Only the author can delete a message');
  }

  if (message.deletedAt) return dto.toMessage(message);

  return dto.toMessage(await repository.softDeleteMessage(messageId));
};

export default {
  requireChannel,
  listMessages,
  getUnreadCount,
  getUnreadSummary,
  recipientsOf,
  markRead,
  sendMessage,
  editMessage,
  deleteMessage,
};
