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

/**
 * The dashboard's numbers for every live, unarchived workspace the user is in —
 * three aggregate queries, run in parallel, each ONE round trip.
 *
 * Aggregated in SQL rather than by loading rows: an overview across six
 * workspaces is hundreds of tasks, and shipping them to Node to count them is
 * both the slow path and the wrong one. `COUNT(*) FILTER` keeps "overdue" in
 * the same scan as the per-group counts.
 *
 * Scope is the caller's membership, joined in every query — the same rule as
 * `GET /workspaces` — so a workspace they left cannot leak a count. Every
 * member sees every project in a workspace (docs/api/project.md §Guards), so
 * no project-level filter applies. Archived and deleted projects are left out,
 * as they are from the projects list; sub-tasks are left out, as they are
 * from every roll-up (sprints, backlog counts).
 *
 * "Overdue" is a due date before today (UTC day boundary) on a task not in a
 * Complete-group status — the same reading `lib/task-delay.ts` uses.
 */
const findOverviewForUser = async (userId) => {
  const [workspaces, projects, tasks] = await Promise.all([
    prisma.$queryRaw`
      SELECT w.id, w.name, w.icon, w.color,
        (SELECT COUNT(*)::int FROM memberships m2 WHERE m2."workspaceId" = w.id) AS members,
        (SELECT COUNT(*)::int FROM sprints s
           JOIN projects p ON p.id = s."projectId" AND p."deletedAt" IS NULL AND p."isArchived" = false
          WHERE p."workspaceId" = w.id AND s.state = 'ACTIVE') AS "activeSprints"
      FROM memberships ms
      JOIN workspaces w ON w.id = ms."workspaceId" AND w."deletedAt" IS NULL AND w."isArchived" = false
      WHERE ms."userId" = ${userId}
      ORDER BY w."createdAt" DESC
    `,
    prisma.$queryRaw`
      SELECT p."workspaceId", p.status::text AS status, COUNT(*)::int AS count
      FROM projects p
      JOIN memberships ms ON ms."workspaceId" = p."workspaceId" AND ms."userId" = ${userId}
      WHERE p."deletedAt" IS NULL AND p."isArchived" = false
      GROUP BY p."workspaceId", p.status
    `,
    prisma.$queryRaw`
      SELECT p."workspaceId", so."group"::text AS "group", COUNT(*)::int AS count,
        COUNT(*) FILTER (
          WHERE t."dueDate" < date_trunc('day', now()) AND so."group" <> 'COMPLETE'
        )::int AS overdue,
        COALESCE(SUM(t."storyPoints"), 0)::int AS points
      FROM tasks t
      JOIN projects p ON p.id = t."projectId" AND p."deletedAt" IS NULL AND p."isArchived" = false
      JOIN memberships ms ON ms."workspaceId" = p."workspaceId" AND ms."userId" = ${userId}
      JOIN task_status_options so ON so.id = t."statusId"
      WHERE t."deletedAt" IS NULL AND t."parentId" IS NULL
      GROUP BY p."workspaceId", so."group"
    `,
  ]);

  return { workspaces, projects, tasks };
};

export default {
  findOverviewForUser,
  createWorkspaceWithOwner,
  findWorkspaceForMember,
  findWorkspacesForUser,
  updateWorkspace,
  setArchived,
  softDeleteWorkspace,
};
