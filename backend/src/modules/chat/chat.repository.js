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
/* Nickname and photo travel with every message because the bubble draws the
   person, not a row: `nickname` is the name they chose for themselves (the
   same precedence `lib/profile.ts#displayName` applies), and `avatarUrl` is
   what the disc beside the bubble shows instead of an initial. */
const SENDER = {
  select: { id: true, name: true, nickname: true, email: true, avatarUrl: true },
};

const findMessages = ({ workspaceId, limit, cursor }) =>
  prisma.message.findMany({
    where: {
      workspaceId,
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

/* The message carries its workspace, which is the only thing a write rule asks
   about — who may edit here, who may delete somebody else's. */
const findMessageById = (messageId) =>
  prisma.message.findFirst({
    where: { id: messageId, workspace: { deletedAt: null } },
    include: { sender: SENDER },
  });

/* `attachments` is stored as NULL when there are none — see the migration on
   why an empty array would be a JSONB document on every text message. */
const createMessage = ({ workspaceId, senderId, content, attachments }) =>
  prisma.message.create({
    data: {
      workspaceId,
      senderId,
      content,
      attachments: attachments?.length ? attachments : undefined,
    },
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
const countUnread = ({ workspaceId, userId, lastReadAt }) =>
  prisma.message.count({
    where: {
      workspaceId,
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

/**
 * Every live workspace the user belongs to, with their watermark in it — the
 * input to the bell's cross-workspace unread summary. One query for the list;
 * the counts are per workspace (a person is in a handful, not hundreds).
 */
const findMembershipsWithReadState = (userId) =>
  prisma.membership.findMany({
    where: { userId, workspace: { deletedAt: null } },
    select: {
      workspace: {
        select: {
          id: true,
          name: true,
          icon: true,
          messageReads: { where: { userId }, select: { lastReadAt: true } },
        },
      },
    },
  });

/** Everyone in the workspace but `exceptUserId` — who a new message is news to. */
const findMemberIds = async (workspaceId, exceptUserId) => {
  const rows = await prisma.membership.findMany({
    where: { workspaceId, userId: { not: exceptUserId } },
    select: { userId: true },
  });

  return rows.map((row) => row.userId);
};

const findReadState = (userId, workspaceId) =>
  prisma.messageRead.findUnique({ where: { userId_workspaceId: { userId, workspaceId } } });

/**
 * Moves the caller's watermark. The service passes an `at` it has already
 * clamped — this file does not know that a watermark only moves forward, only
 * how to write the value it is given.
 */
const upsertRead = ({ userId, workspaceId, at }) =>
  prisma.messageRead.upsert({
    where: { userId_workspaceId: { userId, workspaceId } },
    create: { userId, workspaceId, lastReadAt: at },
    update: { lastReadAt: at },
  });

export default {
  findMessages,
  findMessageById,
  createMessage,
  updateMessage,
  softDeleteMessage,
  countUnread,
  findUserSummary,
  findMembershipsWithReadState,
  findMemberIds,
  findReadState,
  upsertRead,
};
