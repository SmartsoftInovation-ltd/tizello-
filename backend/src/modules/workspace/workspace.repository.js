/**
 * Every Prisma call the workspace module makes. No business rules live here —
 * the service decides what a request means; this file only knows how to read
 * and write the rows.
 *
 * `deletedAt: null` is unconditional on every read below. There is no flag to
 * see a soft-deleted workspace through this repository — a caller that
 * genuinely needs one (a future purge job) queries Prisma directly rather
 * than this file growing an `includeDeleted` parameter nothing else should
 * ever pass `true`.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/workspace.md
 */

import prisma from '../../config/db.js';
import { ROLES } from '../../shared/constants/roles.js';
import { withUniqueSlug } from '../../shared/utils/slug.js';

/**
 * Creates a workspace and its OWNER membership in one transaction. A
 * workspace with no OWNER membership is an invariant violation, never a
 * valid intermediate state — see .claude/plan/workspace.md §2.3.
 *
 * The slug retry loop wraps the whole transaction, not just the insert: a
 * `P2002` on the slug column must roll back the membership insert too, or a
 * retried attempt leaves an orphaned membership pointing at a workspace that
 * was never created.
 */
const createWorkspaceWithOwner = ({ name, description, icon, color, ownerId }) =>
  withUniqueSlug(name, (slug) =>
    prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: { name, slug, description, icon, color },
      });

      await tx.membership.create({
        data: { userId: ownerId, workspaceId: workspace.id, role: ROLES.OWNER },
      });

      return workspace;
    })
  );

/**
 * One live workspace. Never returns a soft-deleted row.
 *
 * NO `include` of the caller's membership. It used to attach one "so the
 * service can read their role", but every caller runs behind `loadMembership`,
 * which already resolved that row (cached) and hands the role in — the
 * attached copy was read by nothing, and on Prisma's default strategy an
 * `include` is a second round trip to a database ~164ms away. `userId` stays
 * in the signature so call sites keep saying whose view this is.
 */
// eslint-disable-next-line no-unused-vars
const findWorkspaceForMember = (id, userId) =>
  prisma.workspace.findFirst({ where: { id, deletedAt: null } });

/**
 * Every workspace the user belongs to, newest first, paginated. `deletedAt`
 * is excluded unconditionally; `isArchived` only when `includeArchived` is
 * false — see docs/api/workspace.md §2.
 */
const findWorkspacesForUser = async (userId, { page, limit, includeArchived }) => {
  const where = {
    deletedAt: null,
    ...(includeArchived ? {} : { isArchived: false }),
    memberships: { some: { userId } },
  };

  const [rows, total] = await Promise.all([
    prisma.workspace.findMany({
      where,
      include: { memberships: { where: { userId } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.workspace.count({ where }),
  ]);

  return { rows, total };
};

const updateWorkspace = (id, patch) => prisma.workspace.update({ where: { id }, data: patch });

const setArchived = (id, isArchived) =>
  prisma.workspace.update({ where: { id }, data: { isArchived } });

// Never touches Membership or Invitation rows — a real purge policy is
// tracked as an open question in docs/api/workspace.md, not implemented here.
const softDeleteWorkspace = (id) =>
  prisma.workspace.update({ where: { id }, data: { deletedAt: new Date() } });

export default {
  createWorkspaceWithOwner,
  findWorkspaceForMember,
  findWorkspacesForUser,
  updateWorkspace,
  setArchived,
  softDeleteWorkspace,
};
