/**
 * Every Prisma call the task-status module makes. No business rules — which
 * status is the default, whether a reorder is complete, what happens to a
 * deleted status's tasks: all of that is the service's.
 *
 * Ordering is `group` then `position`. `group` is a Postgres enum, and Postgres
 * sorts an enum by declaration order (TODO, IN_PROGRESS, COMPLETE), so the
 * status list comes back in display order without a CASE expression.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/task.md §Statuses
 */

import prisma from '../../config/db.js';

const STATUS_ORDER = [{ group: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }];

// Live tasks only: a soft-deleted task still references its status (the FK is
// RESTRICT), but "3 tasks" on a status chip means tasks somebody can see.
const WITH_TASK_COUNT = {
  _count: { select: { tasks: { where: { deletedAt: null } } } },
};

const countForProject = (projectId) => prisma.taskStatusOption.count({ where: { projectId } });

/** `skipDuplicates` makes two concurrent first reads of a new project harmless — the unique (projectId, name) absorbs the second insert. */
const createDefaults = (projectId, defaults) =>
  prisma.taskStatusOption.createMany({
    data: defaults.map((status) => ({ ...status, projectId })),
    skipDuplicates: true,
  });

const findStatusesForProject = (projectId) =>
  prisma.taskStatusOption.findMany({
    where: { projectId },
    orderBy: STATUS_ORDER,
    include: WITH_TASK_COUNT,
  });

const findStatus = (projectId, id) =>
  prisma.taskStatusOption.findFirst({ where: { id, projectId } });

/** The default, or — only if the single-default invariant was ever broken — the first status in display order. */
const findDefault = async (projectId) =>
  (await prisma.taskStatusOption.findFirst({ where: { projectId, isDefault: true } })) ??
  prisma.taskStatusOption.findFirst({ where: { projectId }, orderBy: STATUS_ORDER });

const lastPositionInGroup = async (projectId, group) => {
  const last = await prisma.taskStatusOption.aggregate({
    where: { projectId, group },
    _max: { position: true },
  });

  return last._max.position ?? 0;
};

const createStatus = (data) =>
  prisma.taskStatusOption.create({ data, include: WITH_TASK_COUNT });

/**
 * One transaction when the patch makes this status the default: clearing the
 * old default and setting the new one must land together, or a project is left
 * with two defaults (or none) between the writes.
 */
const updateStatus = (projectId, id, patch) =>
  prisma.$transaction(async (tx) => {
    if (patch.isDefault) {
      await tx.taskStatusOption.updateMany({
        where: { projectId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    return tx.taskStatusOption.update({ where: { id }, data: patch, include: WITH_TASK_COUNT });
  });

/** Every status's group and position, rewritten atomically. */
const reorderStatuses = (entries) =>
  prisma.$transaction(
    entries.map(({ id, group, position }) =>
      prisma.taskStatusOption.update({ where: { id }, data: { group, position } })
    )
  );

/**
 * Moves EVERY task on the status — soft-deleted ones included, because the
 * foreign key is RESTRICT and a deleted task would otherwise block the delete —
 * to the replacement, then removes the status. One transaction, so no task is
 * ever left pointing at nothing.
 */
const deleteStatus = (id, replacementId) =>
  prisma.$transaction([
    prisma.task.updateMany({ where: { statusId: id }, data: { statusId: replacementId } }),
    prisma.taskStatusOption.delete({ where: { id } }),
  ]);

export default {
  countForProject,
  createDefaults,
  findStatusesForProject,
  findStatus,
  findDefault,
  lastPositionInGroup,
  createStatus,
  updateStatus,
  reorderStatuses,
  deleteStatus,
};
