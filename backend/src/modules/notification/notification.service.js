/**
 * Notifications: the reads the bell makes, and the one function every other
 * module calls to send one.
 *
 * **SENDING NEVER THROWS.** `notifyTaskAssigned` is called from inside
 * `task.service.js` after the task has already been written. A failure here —
 * Redis down, a deleted user, anything — must not turn a successful assignment
 * into a 500 and roll the caller's UI back over work that was actually saved.
 * It logs and returns. That is the one place in this codebase where swallowing
 * an error is correct, and it is correct because the notification is a
 * side-effect of the write rather than part of it.
 *
 * **The actor is never notified.** Assigning yourself a task is not news, and
 * a bell that lights up for your own actions is one people learn to ignore.
 *
 * See docs/api/notification.md and .claude/skills/module-consistency/SKILL.md
 */

import repository from './notification.repository.js';
import dto from './notification.dto.js';
import { ASSIGNMENT_EMAIL_ATTEMPTS, enqueueAssignmentEmail } from '../../queues/email.queue.js';
import prisma from '../../config/db.js';
import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import { AUTH_CODES } from '../../shared/constants/authCodes.js';
import { resolveProjectAccess } from '../../shared/services/project-access.js';
import { createLogger } from '../../config/logger.js';
import { emitToUser } from '../../realtime/emit.js';

const log = createLogger('notification');

const list = async (userId, query) => {
  const [rows, unreadCount] = await Promise.all([
    repository.findForUser(userId, query),
    repository.countUnread(userId),
  ]);

  return { notifications: rows.map(dto.toNotification), unreadCount };
};

const unreadCount = (userId) => repository.countUnread(userId);

/**
 * Marks one read and returns it.
 *
 * Idempotent: a second call on an already-read notification updates nothing
 * and still answers with the row. Marking read is not a state transition
 * anybody can get wrong twice, and a `409` on a double-tap would be a worse
 * answer than doing nothing.
 *
 * `null` when the id is unknown OR belongs to somebody else — the controller
 * turns both into the same `404`, because distinguishing them confirms that an
 * id is live for another user.
 */
const markRead = async (userId, notificationId) => {
  await repository.markRead(userId, notificationId);
  const row = await repository.findById(userId, notificationId);

  return row ? dto.toNotification(row) : null;
};

const markAllRead = async (userId) => {
  const { count } = await repository.markAllRead(userId);

  return { count };
};

/**
 * Tells people they were put on a task. Called from `task.service.js` on
 * create, update and bulk-update, with the users who are NEWLY on it.
 *
 * The sprint's name rides along because that is the question this feature was
 * built to answer — "you were assigned something in Sprint 3" is the sentence,
 * and joining task → sprint on every bell render to reconstruct it would be a
 * join per row on a list nobody scrolls.
 *
 * The email is enqueued, never sent inline: SMTP latency belongs on the queue,
 * and a `PATCH /tasks/:id` must return as soon as the row is written.
 *
 * `task` is the DTO, not the row — it already carries `key` (`TIZ-42`), which
 * is composed from the project key and the number rather than stored.
 */
const notifyTaskAssigned = async ({ task, recipientIds, actor, projectName, sprintName }) => {
  try {
    /* Never the actor, and never the same person twice — a client that sends a
       duplicate id should not produce two bells. */
    const recipients = [...new Set(recipientIds)].filter((id) => id && id !== actor?.id);
    if (recipients.length === 0) return;

    const actorName = actor?.name?.trim() || 'Someone';
    const where = sprintName ? ` in ${sprintName}` : '';

    const rows = recipients.map((userId) => ({
      userId,
      type: 'TASK_ASSIGNED',
      title: `${actorName} assigned you ${task.key}`,
      body: task.title,
      actorId: actor?.id ?? null,
      taskId: task.id,
      projectName: projectName ?? null,
      sprintName: sprintName ?? null,
    }));

    await repository.createMany(rows);

    /* The realtime push, AFTER the insert. A socket event that arrived before
       the row was committed would tell a bell to refetch a list that does not
       yet contain what it is announcing — and the refetch is what the client
       does with this, because the payload is a nudge rather than the data.
       Sending the row itself would mean two sources of truth for the same
       list, and the one that arrived over a socket would be the one nobody
       revalidated.
       
       `emitToUser` is a no-op when no server is attached (a worker, a script),
       so this needs no guard of its own. */
    for (const userId of recipients) {
      emitToUser(userId, 'notification:new', { unreadDelta: 1 });
    }

    /* NOT AWAITED, deliberately. `emailQueue.add` goes to Redis, and ioredis
       BUFFERS commands while it reconnects rather than rejecting them — so a
       Redis that is down or slow does not fail here, it HANGS, and awaiting it
       would hang `PATCH /tasks/:id` behind it. The durable half of this
       feature is the row that was just written; the email is best-effort, and
       a queue that cannot be reached is a mail nobody gets rather than an
       assignment nobody can make. The `.catch` is what keeps the rejection
       from surfacing as an unhandled rejection later. */
    for (const userId of recipients) {
      enqueueAssignmentEmail({
        userId,
        taskId: task.id,
        actorId: actor?.id ?? null,
        actorName,
        sprintName: sprintName ?? null,
        projectName: projectName ?? null,
      }).catch((error) => {
        log.error({ err: error, userId, taskId: task.id }, 'Failed to queue assignment email');
      });
    }

    log.debug({ taskId: task.id, recipients: recipients.length }, `Assignment notified${where}`);
  } catch (error) {
    /* See the header: a side-effect of a completed write must not fail it. */
    log.error({ err: error, taskId: task?.id }, 'Failed to send assignment notifications');
  }
};

/**
 * An assignment email failed all its retries (`email.worker.js`, on the final
 * `failed` event). Tell the person who assigned it and the workspace's owners
 * and admins — never the assignee, who is the one not receiving mail — with
 * the assignee as the notification's SUBJECT so the row can offer a resend.
 *
 * Runs in the worker process, where `emitToUser` is a no-op; the bell picks
 * the row up on its next fetch. Never throws: it is called from an event
 * handler, where a rejection would be unhandled.
 */
const notifyAssignmentEmailFailed = async ({ userId, taskId, actorId }) => {
  try {
    const context = await repository.findAssignmentFailureContext({ taskId, userId });
    if (!context) return;

    const { task, user, adminIds } = context;
    const recipients = [...new Set([actorId, ...adminIds])].filter((id) => id && id !== userId);
    if (recipients.length === 0) return;

    const key = `${task.project.key}-${task.number}`;
    const who = user.name?.trim() || user.email;

    await repository.createMany(
      recipients.map((recipientId) => ({
        userId: recipientId,
        type: 'ASSIGNMENT_EMAIL_FAILED',
        title: `Couldn't email ${who} about ${key}`,
        body: `${user.email} — failed after ${ASSIGNMENT_EMAIL_ATTEMPTS} tries. Resend it from here.`,
        actorId: actorId ?? null,
        subjectUserId: user.id,
        taskId: task.id,
        projectName: task.project.name,
        sprintName: task.sprint?.name ?? null,
      }))
    );

    for (const recipientId of recipients) emitToUser(recipientId, 'notification:new', { unreadDelta: 1 });
  } catch (error) {
    log.error({ err: error, userId, taskId }, 'Failed to record assignment email failure');
  }
};

/**
 * `POST /notifications/:notificationId/resend-email` — queue the assignment
 * email again for the one person a failure notification is about.
 *
 * Three checks, each a reason the resend would be wrong rather than merely
 * useless: the notification is the reader's own and of the failure type; the
 * reader may still work that task's project (they may have lost the role that
 * got them the notification); and the subject is still assigned — re-emailing
 * someone who was taken off the task would announce work they no longer have.
 */
const resendAssignmentEmail = async (reader, notificationId) => {
  const notification = await repository.findOwnedWithTask(reader.id, notificationId);
  if (!notification || notification.type !== 'ASSIGNMENT_EMAIL_FAILED' || !notification.taskId || !notification.subjectUserId) {
    throw new AppError(httpStatus.NOT_FOUND, 'Notification not found', AUTH_CODES.NOT_FOUND);
  }

  const task = await prisma.task.findUnique({ where: { id: notification.taskId }, select: { id: true, projectId: true } });
  const access = task ? await resolveProjectAccess(reader.id, task.projectId) : null;
  if (!access?.canContribute) {
    throw new AppError(httpStatus.FORBIDDEN, 'You do not have permission to perform this action', AUTH_CODES.FORBIDDEN);
  }

  if (!(await repository.isAssignee(task.id, notification.subjectUserId))) {
    throw new AppError(httpStatus.CONFLICT, 'That person is no longer assigned to this task', AUTH_CODES.CONFLICT);
  }

  /* The access token carries no name, so the email's "assigned by" is read. */
  const sender = await prisma.user.findUnique({ where: { id: reader.id }, select: { name: true, email: true } });

  await enqueueAssignmentEmail({
    userId: notification.subjectUserId,
    taskId: task.id,
    actorId: reader.id,
    actorName: sender?.name?.trim() || sender?.email || 'Someone',
    sprintName: notification.sprintName,
    projectName: notification.projectName,
  });

  await repository.markRead(reader.id, notificationId);
};

export default {
  list,
  unreadCount,
  markRead,
  markAllRead,
  notifyTaskAssigned,
  notifyAssignmentEmailFailed,
  resendAssignmentEmail,
};
