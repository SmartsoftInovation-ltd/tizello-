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
const WITH_PEOPLE = { actor: ACTOR, subject: ACTOR };

const findForUser = (userId, { limit, before, unreadOnly }) =>
  prisma.notification.findMany({
    where: {
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    include: WITH_PEOPLE,
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
    include: WITH_PEOPLE,
  });

/* One insert for the whole fan-out. Assigning three people is one statement,
   not three round trips inside a loop. */
const createMany = (rows) => prisma.notification.createMany({ data: rows });

/**
 * Everything the "email failed" notification says, in one read: the task with
 * its key parts, project, sprint and workspace; the assignee whose email
 * failed; and who in that workspace should hear about it (OWNER and ADMIN
 * tiers — the people who run it).
 */
const findAssignmentFailureContext = async ({ taskId, userId }) => {
  const [task, user] = await Promise.all([
    prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        number: true,
        title: true,
        deletedAt: true,
        project: { select: { key: true, name: true, workspaceId: true } },
        sprint: { select: { name: true } },
      },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }),
  ]);

  if (!task || task.deletedAt || !user) return null;

  const admins = await prisma.membership.findMany({
    where: { workspaceId: task.project.workspaceId, role: { in: ['OWNER', 'ADMIN'] } },
    select: { userId: true },
  });

  return { task, user, adminIds: admins.map((row) => row.userId) };
};

/** The reader's own notification, with what a resend needs. Null for anyone else's. */
const findOwnedWithTask = (userId, notificationId) =>
  prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: {
      id: true,
      type: true,
      taskId: true,
      subjectUserId: true,
      projectName: true,
      sprintName: true,
    },
  });

const isAssignee = (taskId, userId) =>
  prisma.taskAssignee.findUnique({ where: { taskId_userId: { taskId, userId } } });

export default {
  findAssignmentFailureContext,
  findOwnedWithTask,
  isAssignee,
  findForUser,
  countUnread,
  markRead,
  markAllRead,
  findById,
  createMany,
};
