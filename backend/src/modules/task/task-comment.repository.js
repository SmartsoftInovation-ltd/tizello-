/**
 * Every Prisma call the task-comment module makes. No business rules.
 *
 * Comments are hard-deleted, unlike tasks: a comment is not something anybody
 * restores, and a soft-deleted one would have to be filtered out of every
 * thread and every `commentCount` for no reader's benefit.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/task.md
 */

import prisma from '../../config/db.js';

/** A thread is read whole; the cap is what stops one runaway task from being an unbounded payload. */
const MAX_COMMENTS = 500;

const AUTHOR = { author: { select: { id: true, name: true, email: true } } };

const findCommentsForTask = (taskId) =>
  prisma.taskComment.findMany({
    where: { taskId },
    include: AUTHOR,
    orderBy: { createdAt: 'asc' },
    take: MAX_COMMENTS,
  });

/** Scoped by task as well as id, so a comment id from another task is simply not found. */
const findComment = (taskId, id) => prisma.taskComment.findFirst({ where: { id, taskId } });

const createComment = (taskId, authorId, body) =>
  prisma.taskComment.create({ data: { taskId, authorId, body }, include: AUTHOR });

const deleteComment = (id) => prisma.taskComment.delete({ where: { id } });

export default { findCommentsForTask, findComment, createComment, deleteComment };
