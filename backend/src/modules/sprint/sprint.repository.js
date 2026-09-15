/**
 * Every Prisma call the sprint module makes. No business rules.
 *
 * Sprints are HARD-deleted, unlike tasks and projects: only a PLANNING sprint
 * may be deleted (the service enforces it), and a sprint that never ran is not
 * history anyone restores. The foreign key on `tasks.sprintId` is `SetNull`, so
 * the delete itself returns its tasks to the backlog.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/sprint.md
 */

import prisma from '../../config/db.js';

const CREATED_BY = { createdBy: { select: { id: true, name: true, email: true } } };

/**
 * Allocates the next sprint number and inserts the sprint in ONE transaction —
 * the same atomic `UPDATE … RETURNING` the task module uses for task numbers,
 * for the same reasons: concurrent creates cannot collide, and a failed insert
 * does not burn a number. `nameFor` receives the number, because the default
 * name contains it.
 */
const createSprint = (projectId, nameFor, data) =>
  prisma.$transaction(async (tx) => {
    const [{ sprintCounter }] = await tx.$queryRaw`
      UPDATE "projects"
      SET "sprintCounter" = "sprintCounter" + 1
      WHERE "id" = ${projectId}
      RETURNING "sprintCounter"
    `;

    return tx.sprint.create({
      data: { ...data, name: nameFor(sprintCounter), projectId, number: sprintCounter },
      include: CREATED_BY,
    });
  });

const findSprintsForProject = (projectId, state) =>
  prisma.sprint.findMany({
    where: { projectId, ...(state ? { state } : {}) },
    include: CREATED_BY,
    orderBy: { number: 'asc' },
  });

const findSprintById = (id) => prisma.sprint.findUnique({ where: { id }, include: CREATED_BY });

/** For the task module: a sprint of THIS project, or null. */
const findSprintInProject = (projectId, id) =>
  prisma.sprint.findFirst({ where: { id, projectId }, select: { id: true, name: true, state: true } });

const findActiveSprint = (projectId) =>
  prisma.sprint.findFirst({ where: { projectId, state: 'ACTIVE' }, select: { id: true, name: true } });

/**
 * The rows the roll-ups are computed from: live, TOP-LEVEL tasks of the given
 * sprints. Sub-tasks are excluded — they ride with their parent and carry its
 * work, so counting both would count the same work twice.
 */
const findRollupRows = (sprintIds) =>
  prisma.task.findMany({
    where: { sprintId: { in: sprintIds }, deletedAt: null, parentId: null },
    select: { sprintId: true, storyPoints: true, status: { select: { group: true } } },
  });

const updateSprint = (id, data) => prisma.sprint.update({ where: { id }, data, include: CREATED_BY });

/** Live tasks of a sprint that are not in a Complete-group status — what completing returns. */
const findUnfinishedTaskIds = async (sprintId) =>
  (
    await prisma.task.findMany({
      where: { sprintId, deletedAt: null, status: { group: { not: 'COMPLETE' } } },
      select: { id: true },
    })
  ).map((row) => row.id);

const findLiveTaskIds = async (sprintId) =>
  (await prisma.task.findMany({ where: { sprintId, deletedAt: null }, select: { id: true } })).map(
    (row) => row.id
  );

/**
 * Completes a sprint and returns its unfinished tasks to the backlog, together.
 * Split, a crash between the two would leave a COMPLETED sprint still holding
 * work nobody can see on any board.
 */
const completeSprint = (id, returnTaskIds) =>
  prisma.$transaction(async (tx) => {
    if (returnTaskIds.length > 0) {
      await tx.task.updateMany({ where: { id: { in: returnTaskIds } }, data: { sprintId: null } });
    }

    return tx.sprint.update({
      where: { id },
      data: { state: 'COMPLETED', completedAt: new Date() },
      include: CREATED_BY,
    });
  });

const deleteSprint = (id) => prisma.sprint.delete({ where: { id } });

export default {
  createSprint,
  findSprintsForProject,
  findSprintById,
  findSprintInProject,
  findActiveSprint,
  findRollupRows,
  updateSprint,
  findUnfinishedTaskIds,
  findLiveTaskIds,
  completeSprint,
  deleteSprint,
};
