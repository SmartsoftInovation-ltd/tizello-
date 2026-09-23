/**
 * Chat's business rules — ALL of them, for both transports.
 *
 * The REST controller and the `/chat` socket namespace are two doors into this
 * file. Neither holds a permission rule of its own: a rule enforced on one and
 * forgotten on the other is the single most likely way this feature leaks a
 * conversation, and the only defence that scales is having one place where the
 * rules are.
 *
 * **PERSIST, THEN BROADCAST.** `sendMessage` returns a saved row and nothing
 * else; the namespace broadcasts what it returns. Broadcast-first is faster and
 * wrong — a failed insert leaves a message on every screen in the room that no
 * history load will ever return, and the only way to notice is to reload.
 * Nothing in this file emits, which is what makes the ordering structural
 * rather than a convention to remember.
 *
 * **THE SENDER IS THE CALLER.** Every write takes a `userId` resolved from the
 * session — `req.user.id` or `socket.data.userId` — and the payload's own
 * `senderId` is rejected by the validator before it reaches here.
 *
 * Throws `AppError` with an `AUTH_CODES` code, never touches `res`, never
 * imports Prisma.
 *
 * See docs/api/chat.md, .claude/plan/chat.md and
 * .claude/skills/module-consistency/SKILL.md
 */

import repository from './chat.repository.js';
import dto from './chat.dto.js';
import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import { AUTH_CODES } from '../../shared/constants/authCodes.js';
import { resolveProjectAccess } from '../../shared/services/project-access.js';

/* A channel nobody may see and a channel that does not exist are one answer.
   Confirming a project exists to somebody with no access to it is itself the
   leak — the same rule `loadProject` applies. */
const notFound = (what = 'Project') =>
  new AppError(httpStatus.NOT_FOUND, `${what} not found`, AUTH_CODES.NOT_FOUND);

const forbidden = (message) =>
  new AppError(httpStatus.FORBIDDEN, message, AUTH_CODES.FORBIDDEN);

/**
 * Resolves the caller's access to a channel, or throws.
 *
 * `null` from the resolver — no such project, soft-deleted, or a workspace the
 * caller is not in — is a `404`. A resolved project the caller may only read
 * at project level is ALSO a `404` rather than a `403`: a workspace member who
 * is not on the project can see the project and must not learn what its channel
 * contains, and `403` would tell them there is one. docs/api/chat.md §1.
 */
const requireChannel = async (userId, projectId) => {
  const access = await resolveProjectAccess(userId, projectId);

  if (!access || !access.canContribute) throw notFound();

  return access;
};

/* --- reads -------------------------------------------------------------- */

/**
 * One page of history, newest first.
 *
 * `nextCursor` is null at the beginning of the channel, and specifically when
 * the page came back shorter than `limit` — a client that keeps requesting
 * after that is paging past the start.
 */
const listMessages = async (userId, projectId, { limit, cursor } = {}) => {
  await requireChannel(userId, projectId);

  const decoded = cursor ? dto.decodeCursor(cursor) : null;

  /* A cursor the server did not write. `VALIDATION_ERROR`, never a silent
     first page: a client that believes it is paging while re-reading the head
     loops forever, and the bug looks like a rendering problem. */
  if (cursor && !decoded) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid cursor', AUTH_CODES.VALIDATION_ERROR, [
      { field: 'cursor', message: 'cursor is not a valid page position' },
    ]);
  }

  const rows = await repository.findMessages({ projectId, limit, cursor: decoded });

  return {
    messages: rows.map(dto.toMessage),
    nextCursor: rows.length === limit ? dto.encodeCursor(rows[rows.length - 1]) : null,
  };
};

const getUnreadCount = async (userId, projectId) => {
  await requireChannel(userId, projectId);

  const state = await repository.findReadState(userId, projectId);

  return repository.countUnread({ projectId, userId, lastReadAt: state?.lastReadAt ?? null });
};

/* --- watermark ---------------------------------------------------------- */

/**
 * Moves the caller's read watermark, idempotently.
 *
 * **IT NEVER MOVES BACKWARDS.** A late request from a tab that was behind must
 * not un-read what another tab already read, so the stored value wins whenever
 * it is the later of the two. That is also why this is an upsert of a
 * timestamp rather than a counter: two tabs racing on a counter disagree, two
 * tabs racing on `max(stored, incoming)` cannot.
 *
 * A future `at` is clamped to now. Without the clamp one request marks the
 * channel unread-proof forever, including for messages nobody has written yet.
 */
const markRead = async (userId, projectId, { at } = {}) => {
  await requireChannel(userId, projectId);

  const now = new Date();
  const requested = at ? new Date(at) : now;
  const clamped = requested > now ? now : requested;

  const state = await repository.findReadState(userId, projectId);
  const next = state && state.lastReadAt > clamped ? state.lastReadAt : clamped;

  const row = await repository.upsertRead({ userId, projectId, at: next });

  return { lastReadAt: row.lastReadAt };
};

/* --- writes ------------------------------------------------------------- */

/**
 * Writes a message and returns it. Broadcasting is the caller's job.
 *
 * **Membership is re-checked here, not trusted from the socket's earlier
 * join.** Join-only would leave somebody removed from a project mid-session
 * broadcasting into it until they refreshed. It is one indexed lookup against
 * a channel that is not high-throughput.
 */
const sendMessage = async (userId, { projectId, content }) => {
  await requireChannel(userId, projectId);

  const row = await repository.createMessage({ projectId, senderId: userId, content });

  return dto.toMessage(row);
};

/**
 * Loads a message and the caller's standing in its project, or throws.
 *
 * The `404` for a message in a channel the caller cannot see is the same `404`
 * as a message id that never existed — otherwise the endpoint is an oracle for
 * "is this id live in some project I am not in".
 */
const loadForWrite = async (userId, messageId) => {
  const message = await repository.findMessageById(messageId);

  if (!message) throw notFound('Message');

  const access = await resolveProjectAccess(userId, message.projectId);

  if (!access || !access.canContribute) throw notFound('Message');

  return { message, access };
};

/**
 * Edits a message. **The author only, with no escape hatch.**
 *
 * An admin who can rewrite somebody's words is a worse property than an admin
 * who cannot remove them — deletion is visible to everyone in the room, an
 * edit is not. So this tier is deliberately narrower than `deleteMessage`'s.
 *
 * Editing a deleted message is `404`, not a resurrection: the tombstone is a
 * record that something was removed, and un-deleting by writing new text would
 * make that record a lie.
 */
const editMessage = async (userId, { messageId, content }) => {
  const { message } = await loadForWrite(userId, messageId);

  if (message.deletedAt) throw notFound('Message');
  if (message.senderId !== userId) throw forbidden('Only the author can edit a message');

  const row = await repository.updateMessage(messageId, content);

  return dto.toMessage(row);
};

/**
 * Soft-deletes a message. The author, or anyone who could manage the project —
 * `canWrite`: workspace OWNER/ADMIN, the project's owner, or a MANAGER.
 *
 * There is no project ADMIN in this schema (`ProjectRole` is
 * OWNER/MANAGER/COLLABORATOR; ADMIN is a workspace tier), so "OWNER/ADMIN" from
 * the brief maps onto exactly this ladder — the same one `requireProjectWrite`
 * applies everywhere else. docs/api/chat.md §3.
 *
 * Deleting an already-deleted message returns the tombstone unchanged rather
 * than a `409`. Two moderators clicking at once is not a conflict anybody can
 * act on, and the second click's answer is the state they wanted.
 */
const deleteMessage = async (userId, { messageId }) => {
  const { message, access } = await loadForWrite(userId, messageId);

  const isAuthor = message.senderId === userId;

  if (!isAuthor && !access.canWrite) {
    throw forbidden('Only the author or a project manager can delete a message');
  }

  if (message.deletedAt) return dto.toMessage(message);

  const row = await repository.softDeleteMessage(messageId);

  return dto.toMessage(row);
};

export default {
  requireChannel,
  listMessages,
  getUnreadCount,
  markRead,
  sendMessage,
  editMessage,
  deleteMessage,
};
