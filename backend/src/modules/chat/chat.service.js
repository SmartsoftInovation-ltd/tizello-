/**
 * Chat's business rules — ALL of them, for both transports and both kinds of
 * channel.
 *
 * The REST controllers and the `/chat` socket namespace are doors into this
 * file. None of them holds a permission rule: a rule enforced on one door and
 * forgotten on another is the likeliest way this feature leaks a conversation,
 * and the only defence that scales is having one place where the rules are.
 *
 * TWO AUDIENCES, ONE PIPE. A workspace channel is every member of the
 * workspace; a project channel is the project's contributors. That is the ONLY
 * difference between them, and `resolveChannel` is where it lives — everything
 * below this comment works on a resolved channel and cannot tell which kind it
 * has. Adding a third kind is a branch in one function.
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
import { resolveProjectAccess } from '../../shared/services/project-access.js';
import { resolveWorkspaceAccess } from '../../shared/services/workspace-access.js';

/* A channel nobody may see and a channel that does not exist are one answer.
   Confirming a workspace or project exists to somebody with no access to it is
   itself the leak — the same rule `loadProject` and `loadMembership` apply. */
const notFound = (what = 'Channel') =>
  new AppError(httpStatus.NOT_FOUND, `${what} not found`, AUTH_CODES.NOT_FOUND);

const forbidden = (message) =>
  new AppError(httpStatus.FORBIDDEN, message, AUTH_CODES.FORBIDDEN);

/**
 * A channel target, as every caller names one: `{ workspaceId }` or
 * `{ projectId }`, never both. The validators enforce the XOR; this reads it.
 */
const targetOf = ({ workspaceId, projectId }) =>
  workspaceId
    ? { kind: 'WORKSPACE', workspaceId }
    : projectId
      ? { kind: 'PROJECT', projectId }
      : null;

/**
 * Resolves a target to a channel the caller may use, or throws.
 *
 * WORKSPACE: any member, because that is what a workspace channel is for.
 * PROJECT: the contribute tier — a workspace member who is not on the project
 * may see the project and may not read its channel (docs/api/chat.md §1).
 *
 * Both refusals are `404`, never `403`: a `403` would confirm the conversation
 * exists to somebody with no access to it.
 *
 * Returns the channel row plus `canModerate` — who may delete somebody else's
 * message. The row is created on first use; see `ensureChannel`.
 */
const resolveChannel = async (userId, target) => {
  const named = targetOf(target ?? {});
  if (!named) throw notFound();

  if (named.kind === 'WORKSPACE') {
    const access = await resolveWorkspaceAccess(userId, named.workspaceId);
    if (!access) throw notFound();

    const channel = await repository.ensureChannel(named);

    return { channel, canModerate: access.canModerate, name: access.workspace.name };
  }

  const access = await resolveProjectAccess(userId, named.projectId);
  if (!access || !access.canContribute) throw notFound();

  const channel = await repository.ensureChannel(named);

  return { channel, canModerate: access.canWrite, name: access.project.name };
};

/**
 * The same resolution, from a channel id a socket already holds.
 *
 * Every socket event after `channel:join` names its channel by id, and this is
 * what stops that id being trusted: the row is loaded, its target is read, and
 * the caller's access to that target is proved again. A client that joined one
 * channel and then sent to another's id gets the same `404` a stranger would.
 */
const resolveChannelById = async (userId, channelId) => {
  const channel = await repository.findChannelById(channelId);
  if (!channel) throw notFound();

  return accessToChannel(userId, channel);
};

/** The same resolution, from a channel row a message already carried. */
const accessToChannel = (userId, channel) =>
  resolveChannel(
    userId,
    channel.kind === 'WORKSPACE'
      ? { workspaceId: channel.workspaceId }
      : { projectId: channel.projectId },
  );

/* --- reads -------------------------------------------------------------- */

/**
 * One page of history, newest first.
 *
 * `nextCursor` is null at the beginning of the channel, and specifically when
 * the page came back shorter than `limit` — a client that keeps asking after
 * that is paging past the start.
 */
const listMessages = async (userId, target, { limit, cursor } = {}) => {
  const { channel } = await resolveChannel(userId, target);

  const decoded = cursor ? dto.decodeCursor(cursor) : null;

  /* A cursor the server did not write. `VALIDATION_ERROR`, never a silent
     first page: a client that believes it is paging while re-reading the head
     loops forever, and the bug looks like a rendering problem. */
  if (cursor && !decoded) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid cursor', AUTH_CODES.VALIDATION_ERROR, [
      { field: 'cursor', message: 'cursor is not a valid page position' },
    ]);
  }

  const rows = await repository.findMessages({
    channelId: channel.id,
    limit,
    cursor: decoded,
  });

  return {
    messages: rows.map(dto.toMessage),
    nextCursor: rows.length === limit ? dto.encodeCursor(rows[rows.length - 1]) : null,
  };
};

const getUnreadCount = async (userId, target) => {
  const { channel } = await resolveChannel(userId, target);
  const state = await repository.findReadState(userId, channel.id);

  return repository.countUnread({
    channelId: channel.id,
    userId,
    lastReadAt: state?.lastReadAt ?? null,
  });
};

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
const markRead = async (userId, target, { at } = {}) => {
  const { channel } = await resolveChannel(userId, target);

  const now = new Date();
  const requested = at ? new Date(at) : now;
  const clamped = requested > now ? now : requested;

  const state = await repository.findReadState(userId, channel.id);
  const next = state && state.lastReadAt > clamped ? state.lastReadAt : clamped;

  const row = await repository.upsertRead({ userId, channelId: channel.id, at: next });

  return { lastReadAt: row.lastReadAt };
};

/* --- writes ------------------------------------------------------------- */

/**
 * Writes a message and returns it. Broadcasting is the caller's job.
 *
 * **Access is re-checked here, not trusted from the socket's earlier join.**
 * Join-only would leave somebody removed from a workspace or project
 * mid-session writing into it until they refreshed. It is one indexed lookup
 * against a channel that is not high-throughput.
 */
const sendMessage = async (userId, channelId, content) => {
  const { channel } = await resolveChannelById(userId, channelId);

  const row = await repository.createMessage({
    channelId: channel.id,
    senderId: userId,
    content,
  });

  return dto.toMessage(row);
};

/**
 * Loads a message and the caller's standing in its channel, or throws.
 *
 * The `404` for a message in a channel the caller cannot see is the same `404`
 * as an id that never existed — otherwise the endpoint is an oracle for "is
 * this id live somewhere I have no access to".
 */
const loadForWrite = async (userId, messageId) => {
  const message = await repository.findMessageById(messageId);
  if (!message) throw notFound('Message');

  const access = await accessToChannel(userId, message.channel).catch(() => null);
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
 * Soft-deletes a message. The author, or whoever moderates that channel —
 * workspace OWNER/ADMIN for a workspace channel, the project-write ladder for
 * a project one.
 *
 * Deleting an already-deleted message returns the tombstone rather than a
 * `409`. Two moderators clicking at once is not a conflict anybody can act on,
 * and the second click's answer is the state they wanted.
 */
const deleteMessage = async (userId, { messageId }) => {
  const { message, canModerate } = await loadForWrite(userId, messageId);

  if (message.senderId !== userId && !canModerate) {
    throw forbidden('Only the author or a moderator can delete a message');
  }

  if (message.deletedAt) return dto.toMessage(message);

  return dto.toMessage(await repository.softDeleteMessage(messageId));
};

export default {
  resolveChannel,
  resolveChannelById,
  listMessages,
  getUnreadCount,
  markRead,
  sendMessage,
  editMessage,
  deleteMessage,
};
