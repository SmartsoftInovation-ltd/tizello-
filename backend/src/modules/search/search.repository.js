/**
 * Every Prisma call the search module makes. No business rules.
 *
 * SCOPE IS A MEMBERSHIP JOIN, NOT A FILTER APPLIED AFTERWARDS. Each query is
 * constrained to the workspaces the caller belongs to inside the `where`, so a
 * row the caller may not see is never read, never counted and never shaped
 * into a DTO. Fetching broadly and filtering in the service would make every
 * future refactor one missing `.filter()` away from a cross-tenant leak.
 *
 * The three reads run against three tables and share nothing, so the service
 * issues them in parallel; they are separate functions here rather than one
 * union query because Prisma has no union and a raw one would lose the
 * relation selects the DTOs need.
 *
 * `mode: 'insensitive'` throughout — someone searching "kanban" must find
 * "Kanban", and Postgres `LIKE` is case-sensitive by default. This is the same
 * `contains`-based matching `project.repository.js` and `task.repository.js`
 * already use for their `q` params; it is a substring match, not full-text
 * ranking. docs/api/search.md §Matching records why.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/search.md
 */

import prisma from '../../config/db.js';

/** Live workspaces the caller is a member of — the boundary every query below sits inside. */
const findWorkspaceIds = async (userId) => {
  const rows = await prisma.membership.findMany({
    where: { userId, workspace: { deletedAt: null } },
    select: { workspaceId: true },
  });

  return rows.map((row) => row.workspaceId);
};

/* A project is visible to every member of its workspace — the same rule
   `findProjectsForWorkspace` applies, where `mine` is an opt-in narrowing
   rather than the default. Archived projects are excluded: archiving means
   "stop showing me this", and a search that resurfaces it has undone it. */
const visibleProject = (workspaceIds) => ({
  workspaceId: { in: workspaceIds },
  deletedAt: null,
  isArchived: false,
});

const findProjects = (workspaceIds, { term, key, limit }) =>
  prisma.project.findMany({
    where: {
      ...visibleProject(workspaceIds),
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        /* Key matched too, because a key is what people actually type — the
           same reasoning `project.repository.js` records for its own `q`. */
        { key: { contains: term, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      key: true,
      status: true,
      icon: true,
      color: true,
      workspaceId: true,
      workspace: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

const findTasks = (workspaceIds, { term, key, limit }) =>
  prisma.task.findMany({
    where: {
      deletedAt: null,
      project: visibleProject(workspaceIds),
      OR: [
        { title: { contains: term, mode: 'insensitive' } },
        /* `key` is set only when the term parsed as `TIZ-12` (see the service).
           It is an equality match on the pair, so typing a task id jumps
           straight to that one task instead of returning every task whose
           title happens to contain a number. */
        ...(key ? [{ number: key.number, project: { key: { equals: key.prefix, mode: 'insensitive' } } }] : []),
      ],
    },
    select: {
      id: true,
      title: true,
      number: true,
      type: true,
      dueDate: true,
      projectId: true,
      sprintId: true,
      project: { select: { id: true, key: true, name: true, workspaceId: true } },
      status: { select: { id: true, name: true, color: true, group: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

const findSprints = (workspaceIds, { term, key, limit }) =>
  prisma.sprint.findMany({
    where: {
      project: visibleProject(workspaceIds),
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        ...(key && key.prefix.toUpperCase() === 'SPR' ? [{ number: key.number }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
      number: true,
      state: true,
      startDate: true,
      endDate: true,
      projectId: true,
      project: { select: { id: true, key: true, name: true, workspaceId: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

export default { findWorkspaceIds, findProjects, findTasks, findSprints };
