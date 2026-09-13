/**
 * Every Prisma call the task-property module makes. No business rules.
 *
 * No soft delete, for the reason `project-property.repository.js` gives: a
 * definition is schema, not content, and a "deleted but recoverable" column
 * would have to be filtered out of every task response anyway. The values it
 * described survive in each task's Json and are dropped by the task DTO.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/task.md
 */

import prisma from '../../config/db.js';

/** Sparse positions (10, 20, 30…) so a reorder is one UPDATE, not a renumber. */
const POSITION_STEP = 10;

const findPropertiesForProject = (projectId) =>
  prisma.taskPropertyDef.findMany({
    where: { projectId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });

const findProperty = (projectId, id) =>
  prisma.taskPropertyDef.findFirst({ where: { id, projectId } });

/**
 * Appends to the end of the project's list. Not transactional, on purpose — a
 * position tie between two concurrent creates is settled by the `createdAt`
 * tiebreak above, which is cheaper than serialising schema edits.
 */
const createProperty = async (projectId, { name, type, options }) => {
  const last = await prisma.taskPropertyDef.aggregate({
    where: { projectId },
    _max: { position: true },
  });

  return prisma.taskPropertyDef.create({
    data: {
      projectId,
      name,
      type,
      options: options ?? null,
      position: (last._max.position ?? 0) + POSITION_STEP,
    },
  });
};

const updateProperty = (id, patch) => prisma.taskPropertyDef.update({ where: { id }, data: patch });

const deleteProperty = (id) => prisma.taskPropertyDef.delete({ where: { id } });

export default {
  findPropertiesForProject,
  findProperty,
  createProperty,
  updateProperty,
  deleteProperty,
};
