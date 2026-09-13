/**
 * Every Prisma call the task module makes. No business rules — the service
 * decides what a request means; this file only knows how to read and write
 * the rows.
 *
 * `deletedAt: null` is unconditional on every read, with no flag to see past
 * it — the rule `project.repository.js` states, for the same reason.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/task.md
 */

import prisma from '../../config/db.js';

/*
 * What every task response is shaped from. The user selects are narrowed to
 * three fields AT THE QUERY, so a task payload can never become a route to a
 * password hash regardless of what the DTO remembers. `_count` on subtasks is
 * filtered to live rows, because a deleted sub-task is not one anybody can open.
 */
const TASK_INCLUDE = {
  project: { select: { key: true } },
  // The four fields a chip needs; `group` is what the frontend buckets by.
  status: { select: { id: true, name: true, color: true, group: true } },
  assignee: { select: { id: true, name: true, email: true } },
  parent: { select: { id: true, number: true, title: true, deletedAt: true } },
  _count: {
    select: {
      subtasks: { where: { deletedAt: null } },
      comments: true,
    },
  },
};

/**
 * Allocates the next number and inserts the task, in ONE transaction.
 *
 * The increment is a single `UPDATE … RETURNING`, which Postgres executes
 * atomically under a row lock — two concurrent creates in the same project get
 * two different numbers without any application-side locking. `count + 1`
 * would hand both the same number, and would reissue a deleted task's number.
 * If the insert fails the increment rolls back with it, so a failed create
 * does not burn a number either. Plan project §2.3.
 */
const createTask = (projectId, data) =>
  prisma.$transaction(async (tx) => {
    const [{ taskCounter }] = await tx.$queryRaw`
      UPDATE "projects"
      SET "taskCounter" = "taskCounter" + 1
      WHERE "id" = ${projectId}
      RETURNING "taskCounter"
    `;

    return tx.task.create({
      data: { ...data, projectId, number: taskCounter },
      include: TASK_INCLUDE,
    });
  });

/** One live task with everything its response needs. */
const findTaskById = (id) =>
  prisma.task.findFirst({ where: { id, deletedAt: null }, include: TASK_INCLUDE });

/**
 * A project's tasks, oldest first, paginated. `parentId: 'none'` narrows to
 * top-level tasks; any other value to the children of that task.
 */
const findTasksForProject = async (projectId, { page, limit, statusId, q, parentId }) => {
  const where = {
    projectId,
    deletedAt: null,
    ...(statusId ? { statusId } : {}),
    ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
    ...(parentId === 'none' ? { parentId: null } : parentId ? { parentId } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: [{ createdAt: 'asc' }, { number: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.task.count({ where }),
  ]);

  return { rows, total };
};

/** The minimum needed to check a would-be parent and walk its ancestry. */
const findParentLink = (id) =>
  prisma.task.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, projectId: true, parentId: true },
  });

const updateTask = (id, data) =>
  prisma.task.update({ where: { id }, data, include: TASK_INCLUDE });

/**
 * Soft-deletes a task and promotes its live sub-tasks to top-level, together.
 *
 * The foreign key's `onDelete: SetNull` only fires on a HARD delete, which
 * never happens here — so without the `updateMany` every child of a deleted
 * task would keep pointing at a row the API pretends does not exist, and the
 * backlog would show sub-tasks of nothing.
 */
const softDeleteTask = (id) =>
  prisma.$transaction([
    prisma.task.updateMany({
      where: { parentId: id, deletedAt: null },
      data: { parentId: null },
    }),
    prisma.task.update({ where: { id }, data: { deletedAt: new Date() } }),
  ]);

/** Is this user in the workspace at all? The guard behind an assignee. */
const findWorkspaceMembership = (workspaceId, userId) =>
  prisma.membership.findUnique({ where: { userId_workspaceId: { userId, workspaceId } } });

export default {
  createTask,
  findTaskById,
  findTasksForProject,
  findParentLink,
  updateTask,
  softDeleteTask,
  findWorkspaceMembership,
};
