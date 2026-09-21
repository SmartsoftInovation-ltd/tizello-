/**
 * Every database read and write for notifications. No business rules here —
 * "do not notify yourself" is a service decision; this file only knows how to
 * ask Postgres.
 *
 * **Every query is scoped by `userId`, without exception.** A notification is
 * the one resource in this app with an audience of exactly one, so ownership
 * is not a permission check somewhere upstream — it is part of the `where` on
 * every statement below. An update that matched on id alone would let anyone
 * mark anyone else's notifications read.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/notification.md
 */

import prisma from '../../config/db.js';

const ACTOR = { select: { id: true, name: true, email: true } };

const findForUser = (userId, { limit, before, unreadOnly }) =>
  prisma.notification.findMany({
    where: {
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    include: { actor: ACTOR },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

const countUnread = (userId) =>
  prisma.notification.count({ where: { userId, readAt: null } });

/**
 * Marks one notification read, scoped to its owner.
 *
 * `updateMany`, not `update`: `update` throws `P2025` when the compound
 * `where` matches nothing, and "this is not yours" and "this does not exist"
 * must be the same answer — otherwise the endpoint confirms that a
 * notification id is live for somebody else. The count tells the service which
 * it was without telling the caller.
 */
const markRead = (userId, notificationId) =>
  prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });

/** Everything still unread, in one statement. */
const markAllRead = (userId) =>
  prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });

const findById = (userId, notificationId) =>
  prisma.notification.findFirst({
    where: { id: notificationId, userId },
    include: { actor: ACTOR },
  });

/* One insert for the whole fan-out. Assigning three people is one statement,
   not three round trips inside a loop. */
const createMany = (rows) => prisma.notification.createMany({ data: rows });

export default {
  findForUser,
  countUnread,
  markRead,
  markAllRead,
  findById,
  createMany,
};
