/**
 * Every database read and write for workspace roles. No business rules here —
 * "a built-in cannot be renamed" is a service decision; this file only knows
 * how to ask Postgres.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/role.md
 */

import prisma from '../../config/db.js';

/* Built-ins first and then by name, so the cards read Owner → Admin → Member →
   whatever the workspace added. `builtIn desc` puts true before false. */
const ORDER = [{ builtIn: 'desc' }, { baseRole: 'desc' }, { name: 'asc' }];

const COUNTS = { _count: { select: { memberships: true } } };

const findByWorkspace = (workspaceId) =>
  prisma.workspaceRole.findMany({
    where: { workspaceId },
    orderBy: ORDER,
    include: COUNTS,
  });

const findById = (id, workspaceId) =>
  prisma.workspaceRole.findFirst({ where: { id, workspaceId }, include: COUNTS });

const findByName = (workspaceId, name) =>
  prisma.workspaceRole.findFirst({ where: { workspaceId, name } });

const create = (data) => prisma.workspaceRole.create({ data, include: COUNTS });

const update = (id, data) =>
  prisma.workspaceRole.update({ where: { id }, data, include: COUNTS });

/* `Membership.roleId` is `onDelete: SetNull`, so the people who held this role
   keep their membership and fall back to their tier's default grant. Deleting a
   role must never delete a member. */
const remove = (id) => prisma.workspaceRole.delete({ where: { id } });

/**
 * Creates the three built-ins for a workspace that has none.
 *
 * `skipDuplicates` rather than a read-then-write: two requests racing on the
 * same workspace both find it empty, and the unique index on
 * `(workspaceId, name)` is what actually settles it. Without the flag the loser
 * throws P2002 and the caller sees a 409 for doing nothing wrong.
 */
const seedBuiltIns = (workspaceId, rows) =>
  prisma.workspaceRole.createMany({
    data: rows.map((row) => ({ ...row, workspaceId, builtIn: true })),
    skipDuplicates: true,
  });

/** How many memberships point at this role. The 409 on delete quotes it. */
const countMembers = (roleId) => prisma.membership.count({ where: { roleId } });

export default {
  findByWorkspace,
  findById,
  findByName,
  create,
  update,
  remove,
  seedBuiltIns,
  countMembers,
};
