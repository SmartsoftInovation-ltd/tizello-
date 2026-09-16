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
 * The gap a new task is given below the last one, and the spacing a rebalance
 * restores. 1024 halves cleanly about forty times inside a double before two
 * neighbours become indistinguishable — see `rebalancePositions`.
 */
const POSITION_STEP = 1024;

/*
 * What every task response is shaped from. The user selects are narrowed to
 * three fields AT THE QUERY, so a task payload can never become a route to a
 * password hash regardless of what the DTO remembers. `_count` on subtasks is
 * filtered to live rows, because a deleted sub-task is not one anybody can open.
 */
const PERSON = { select: { id: true, name: true, email: true } };

const TASK_INCLUDE = {
  project: { select: { key: true } },
  // The four fields a chip needs; `group` is what the frontend buckets by.
  status: { select: { id: true, name: true, color: true, group: true } },
  // Oldest first, so a task's avatars do not reshuffle when someone is added.
  assignees: { orderBy: { createdAt: 'asc' }, select: { user: PERSON } },
  createdBy: PERSON,
  sprint: { select: { id: true, name: true, state: true } },
  parent: { select: { id: true, number: true, title: true, deletedAt: true } },
  _count: {
    select: {
      subtasks: { where: { deletedAt: null } },
      comments: true,
    },
  },
};

/**
 * Allocates the next number and the bottom rank, and inserts the task, in ONE
 * transaction.
 *
 * The increment is a single `UPDATE … RETURNING`, which Postgres executes
 * atomically under a row lock — two concurrent creates in the same project get
 * two different numbers without any application-side locking. `count + 1`
 * would hand both the same number, and would reissue a deleted task's number.
 * If the insert fails the increment rolls back with it, so a failed create
 * does not burn a number either. Plan project §2.3.
 *
 * The rank is read AFTER the counter update, so the project row lock is already
 * held and a concurrent create waits for this one — both cannot read the same
 * maximum. A new task lands at the bottom of the backlog: the order people
 * ranked is theirs, and a new arrival has not been ranked yet.
 */
const createTask = (projectId, data) =>
  prisma.$transaction(async (tx) => {
    const [{ taskCounter }] = await tx.$queryRaw`
      UPDATE "projects"
      SET "taskCounter" = "taskCounter" + 1
      WHERE "id" = ${projectId}
      RETURNING "taskCounter"
    `;

    const { _max } = await tx.task.aggregate({
      where: { projectId, deletedAt: null },
      _max: { position: true },
    });

    return tx.task.create({
      data: {
        ...data,
        projectId,
        number: taskCounter,
        position: (_max.position ?? 0) + POSITION_STEP,
      },
      include: TASK_INCLUDE,
    });
  });

/** One live task with everything its response needs. */
const findTaskById = (id) =>
  prisma.task.findFirst({ where: { id, deletedAt: null }, include: TASK_INCLUDE });

/**
 * Live tasks of ONE project by id, with the response includes. Anything not in
 * the project, deleted, or nonexistent is simply absent — the service compares
 * the count to decide.
 */
const findTasksByIds = (projectId, ids) =>
  prisma.task.findMany({
    where: { id: { in: ids }, projectId, deletedAt: null },
    include: TASK_INCLUDE,
  });

/**
 * A project's tasks in backlog rank order, paginated. `parentId: 'none'`
 * narrows to top-level tasks; any other value to the children of that task.
 * `number` breaks ties, which only exist on rows two concurrent creates wrote.
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
      orderBy: [{ position: 'asc' }, { number: 'asc' }],
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
    select: { id: true, projectId: true, parentId: true, sprintId: true },
  });

/** A move's neighbour: just enough to place a task beside it. */
const findRankLink = (projectId, id) =>
  prisma.task.findFirst({
    where: { id, projectId, deletedAt: null },
    select: { id: true, position: true },
  });

/**
 * Respaces every live task in a project to `POSITION_STEP` apart, keeping their
 * order, in one statement.
 *
 * Only called when a move finds its two neighbours too close to split — a
 * float midpoint cannot be taken forever. One `UPDATE … FROM (ROW_NUMBER())`
 * rather than a row-by-row loop, so a 500-task project is one round trip and
 * never observed half-renumbered.
 */
const rebalancePositions = (projectId) => prisma.$executeRaw`
  UPDATE "tasks" AS t
  SET "position" = ranked.rn * ${POSITION_STEP}
  FROM (
    SELECT "id", ROW_NUMBER() OVER (ORDER BY "position", "number") AS rn
    FROM "tasks"
    WHERE "projectId" = ${projectId} AND "deletedAt" IS NULL
  ) AS ranked
  WHERE t."id" = ranked."id"
`;

const updateTask = (id, data) =>
  prisma.task.update({ where: { id }, data, include: TASK_INCLUDE });

/**
 * One write per task, all in one transaction — a bulk edit lands whole or not
 * at all. Per-row `update`s rather than one `updateMany`, because `completedAt`
 * can differ per task and the response needs every row back with its includes.
 */
const updateTasks = (updates) =>
  prisma.$transaction(
    updates.map(({ id, data }) => prisma.task.update({ where: { id }, data, include: TASK_INCLUDE }))
  );

/**
 * Soft-deletes tasks and promotes their live sub-tasks to top-level, together.
 *
 * The foreign key's `onDelete: SetNull` only fires on a HARD delete, which
 * never happens here — so without the `updateMany` every child of a deleted
 * task would keep pointing at a row the API pretends does not exist, and the
 * backlog would show sub-tasks of nothing. A child that is itself in `ids` is
 * deleted rather than promoted; clearing its parent first is harmless.
 */
const softDeleteTasks = (ids) =>
  prisma.$transaction([
    prisma.task.updateMany({
      where: { parentId: { in: ids }, deletedAt: null },
      data: { parentId: null },
    }),
    prisma.task.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } }),
  ]);

const softDeleteTask = (id) => softDeleteTasks([id]);

/**
 * Puts every live descendant of `parentIds` in `sprintId` (null = backlog).
 *
 * Sub-tasks follow their parent into and out of a sprint: the planning screen
 * shows top-level tasks, and a parent planned into a sprint whose sub-tasks
 * stayed behind would leave its own pieces of work on the backlog. Walked level
 * by level — a task tree is shallow — and capped like the cycle walk.
 */
const moveSubtreeToSprint = async (parentIds, sprintId) => {
  let level = parentIds;

  for (let depth = 0; level.length > 0 && depth < 100; depth += 1) {
    const children = await prisma.task.findMany({
      where: { parentId: { in: level }, deletedAt: null },
      select: { id: true },
    });
    level = children.map((child) => child.id);
    if (level.length > 0) {
      await prisma.task.updateMany({ where: { id: { in: level } }, data: { sprintId } });
    }
  }
};

/** Which of these users are in the workspace? The guard behind assignees. */
const findWorkspaceMemberships = (workspaceId, userIds) =>
  prisma.membership.findMany({ where: { workspaceId, userId: { in: userIds } }, select: { userId: true } });

export default {
  POSITION_STEP,
  createTask,
  findTaskById,
  findTasksByIds,
  findTasksForProject,
  findParentLink,
  findRankLink,
  rebalancePositions,
  updateTask,
  updateTasks,
  softDeleteTask,
  softDeleteTasks,
  moveSubtreeToSprint,
  findWorkspaceMemberships,
};
