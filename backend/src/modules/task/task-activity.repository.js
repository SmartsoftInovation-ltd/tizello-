/**
 * Every Prisma call the task-activity module makes. No business rules.
 *
 * Append-only by construction: there is a create and a read, and nothing that
 * updates or deletes. A history that can be edited is not a history.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/task.md §Activity
 */

import prisma from '../../config/db.js';

/** A history is read whole, newest first; the cap bounds one very busy task. */
const MAX_ENTRIES = 200;

const ACTOR = { actor: { select: { id: true, name: true, email: true } } };

const createEntries = (entries) => prisma.taskActivity.createMany({ data: entries });

const findActivityForTask = (taskId) =>
  prisma.taskActivity.findMany({
    where: { taskId },
    include: ACTOR,
    orderBy: { createdAt: 'desc' },
    take: MAX_ENTRIES,
  });

export default { createEntries, findActivityForTask };
