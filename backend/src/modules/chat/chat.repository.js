/**
 * Every database read and write for chat. No business rules here — who may
 * edit a message is a service decision; this file only knows how to ask
 * Postgres.
 *
 * Prisma appears in this file and nowhere else in the module, which is what
 * lets the service be called from a socket handler, an HTTP controller or a
 * test without any of them knowing there is a database.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/chat.md
 */

import prisma from '../../config/db.js';

/* The sender fields the DTO whitelists, asked for at the query rather than
   fetched whole and trimmed afterwards: a chat page is 30 joins, and `include`
   without `select` would carry every user column — password hash included —
   into process memory on each one. */
const SENDER = { select: { id: true, name: true, email: true, avatarUrl: true } };

/**
 * The channel row for a target, created on first use.
 *
 * LAZY, not seeded: there is no reason for every project that already exists to
 * carry a channel row nobody has opened, and a create-on-read keeps "a channel
 * exists" from being a second fact that migrations have to maintain.
 *
 * `upsert` on the unique target column rather than findFirst-then-create,
 * because two members opening the same channel at the same moment is the normal
 * case, not a race to guard against — the unique index decides and the loser
 * gets the winner's row.
 */
const ensureChannel = ({ kind, workspaceId = null, projectId = null }) =>
  kind === 'WORKSPACE'
    ? prisma.channel.upsert({
        where: { workspaceId },
        create: { kind, workspaceId },
        update: {},
      })
    : prisma.channel.upsert({
        where: { projectId },
        create: { kind, projectId },
        update: {},
      });

/**
 * One page of a channel, newest first.
 *
 * ORDERED AND PAGED BY `(createdAt, id)`, both descending. The `OR` below is
 * the row-value comparison `(createdAt, id) < (cursor.at, cursor.id)` written
 * in Prisma's dialect: strictly older, plus the same instant with a smaller
 * id. A `createdAt: { lt }` alone would skip or repeat messages that share a
 * millisecond — see `chat.dto.js#encodeCursor`.
 *
 * Tombstones are returned, not filtered: the DTO empties their content, and
 * omitting them would leave a reply quoting a removed message dangling.
 */
const findChannelById = (channelId) =>
  prisma.channel.findUnique({ where: { id: channelId } });

const findMessages = ({ channelId, limit, cursor }) =>
  prisma.message.findMany({
    where: {
      channelId,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.at } },
              { createdAt: cursor.at, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    include: { sender: SENDER },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });

/* Includes the channel, because every write rule is a question about the
   channel — who may edit here, who may delete somebody else's — and the caller
   would otherwise have to fetch it a second time to find out. */
const findMessageById = (messageId) =>
  prisma.message.findFirst({
    where: { id: messageId },
    include: { sender: SENDER, channel: true },
  });

const createMessage = ({ channelId, senderId, content }) =>
  prisma.message.create({
    data: { channelId, senderId, content },
    include: { sender: SENDER },
  });

/** Sets `editedAt` with the new text — one statement, so the two cannot part. */
const updateMessage = (messageId, content) =>
  prisma.message.update({
    where: { id: messageId },
    data: { content, editedAt: new Date() },
    include: { sender: SENDER },
  });

/** Soft delete: the row stays, `deletedAt` is stamped, the text is untouched
 *  in the column and removed by the DTO. */
const softDeleteMessage = (messageId) =>
  prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
    include: { sender: SENDER },
  });

/**
 * How many messages in this channel the caller has not read.
 *
 * Excludes tombstones — an unread badge that counts deleted messages sends
 * somebody to look at nothing — and excludes the caller's own, because your
 * own message is not news.
 *
 * `OR: [{ senderId: null }, { senderId: { not: userId } }]` rather than the
 * shorter `{ not: userId }`: SQL's `senderId <> $1` is NULL, not true, for a
 * departed sender's rows, so the short form silently stops counting the
 * messages of anybody who has left.
 *
 * No watermark (`lastReadAt` null) means the whole channel is unread.
 */
const countUnread = ({ channelId, userId, lastReadAt }) =>
  prisma.message.count({
    where: {
      channelId,
      deletedAt: null,
      OR: [{ senderId: null }, { senderId: { not: userId } }],
      ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
    },
  });

/**
 * The display fields for one user, read ONCE per socket connection and cached
 * on `socket.data` by the namespace.
 *
 * Presence and typing indicators both need a name, and neither is worth a
 * query: typing fires on keystrokes, and presence is answered from the room's
 * socket list, which holds ids and nothing else. One read at connection time
 * turns both into pure memory.
 */
const findUserSummary = (userId) =>
  prisma.user.findUnique({ where: { id: userId }, select: SENDER.select });

const findReadState = (userId, channelId) =>
  prisma.messageRead.findUnique({ where: { userId_channelId: { userId, channelId } } });

/**
 * Moves the caller's watermark. The service passes an `at` it has already
 * clamped — this file does not know that a watermark only moves forward, only
 * how to write the value it is given.
 */
const upsertRead = ({ userId, channelId, at }) =>
  prisma.messageRead.upsert({
    where: { userId_channelId: { userId, channelId } },
    create: { userId, channelId, lastReadAt: at },
    update: { lastReadAt: at },
  });

export default {
  ensureChannel,
  findChannelById,
  findMessages,
  findMessageById,
  createMessage,
  updateMessage,
  softDeleteMessage,
  countUnread,
  findUserSummary,
  findReadState,
  upsertRead,
};
