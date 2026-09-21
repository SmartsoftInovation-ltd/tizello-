/**
 * Every Prisma call the trash module makes. No business rules.
 *
 * THIS IS THE ONE MODULE THAT LOOKS FOR `deletedAt: { not: null }`. Every
 * other repository in the app filters soft-deleted rows OUT — that is what
 * makes them invisible — so the queries here are the mirror image, and they
 * are deliberately in their own file rather than as an `includeDeleted` flag
 * threaded through the project and task repositories. A flag like that is one
 * wrong default away from serving deleted rows to a live list.
 *
 * SCOPE IS A MEMBERSHIP JOIN, inside the `where`, exactly as in the search
 * module: a row the caller may not see is never read.
 *
 * A trashed item in a DELETED WORKSPACE is not listed. Deleting a workspace
 * does not stamp its projects, so those projects are not individually
 * trashed — they are simply gone with their container, and restoring one into
 * a workspace that no longer exists would leave it unreachable.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/trash.md
 */

import prisma from '../../config/db.js';

/* The workspace must be live for anything inside it to be restorable. */
const liveWorkspace = (userId) => ({
  deletedAt: null,
  memberships: { some: { userId } },
});

const PROJECT_SELECT = {
  id: true,
  name: true,
  key: true,
  icon: true,
  color: true,
  ownerId: true,
  workspaceId: true,
  deletedAt: true,
  workspace: { select: { id: true, name: true } },
};

/*
 * `members` is scoped to the CALLER and is not optional decoration: the list's
 * `canRestore` flag runs the same `canContribute` ladder the restore endpoint
 * runs, and that ladder asks whether the caller has a `ProjectMember` row.
 * Omit it and the rows come back with `members` undefined, so a collaborator
 * is told `canRestore: false` for a task the endpoint would happily restore —
 * the button hidden from the one person entitled to press it. That is the
 * failure this select exists to prevent, and it is invisible unless the reader
 * is a collaborator, which is why it is written down here.
 */
const taskSelect = (userId) => ({
  id: true,
  title: true,
  number: true,
  type: true,
  deletedAt: true,
  projectId: true,
  project: {
    select: {
      id: true,
      key: true,
      name: true,
      workspaceId: true,
      ownerId: true,
      members: { where: { userId }, select: { role: true } },
    },
  },
});

const findDeletedProjects = (userId, limit) =>
  prisma.project.findMany({
    where: { deletedAt: { not: null }, workspace: liveWorkspace(userId) },
    select: PROJECT_SELECT,
    orderBy: { deletedAt: 'desc' },
    take: limit,
  });

/*
 * Deleted tasks in LIVE projects only. A task inside a deleted project is not
 * its own entry: restoring it would put it back into a project the trash is
 * offering to restore separately, and the reader would have to restore two
 * things in the right order to get one task back. Restore the project and its
 * tasks come with it, because deleting a project never stamped them.
 */
const findDeletedTasks = (userId, limit) =>
  prisma.task.findMany({
    where: {
      deletedAt: { not: null },
      project: { deletedAt: null, workspace: liveWorkspace(userId) },
    },
    select: taskSelect(userId),
    orderBy: { deletedAt: 'desc' },
    take: limit,
  });

/* The single row a restore or a purge acts on, with everything the permission
   decision needs — including the caller's `ProjectMember` row, which is what
   separates a contributor from a workspace member who is merely looking. */
const findDeletedProject = (projectId, userId) =>
  prisma.project.findFirst({
    where: { id: projectId, deletedAt: { not: null }, workspace: liveWorkspace(userId) },
    select: { ...PROJECT_SELECT, members: { where: { userId }, select: { role: true } } },
  });

const findDeletedTask = (taskId, userId) =>
  prisma.task.findFirst({
    where: {
      id: taskId,
      deletedAt: { not: null },
      project: { deletedAt: null, workspace: liveWorkspace(userId) },
    },
    select: taskSelect(userId),
  });

/* The custom role comes with it: `membershipCan` resolves a workspace-defined
   role's grant from it, and a membership read without it silently falls back to
   the tier's default — which is the wrong answer for anyone holding one. */
const membershipFor = (userId, workspaceId) =>
  prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    include: { customRole: { select: { permissions: true } } },
  });

/* `deletedAt: null` is the whole restore — nothing else was changed on the way
   out, which is what makes a soft delete worth having. */
const restoreProject = (id) => prisma.project.update({ where: { id }, data: { deletedAt: null } });

const restoreTask = (id) => prisma.task.update({ where: { id }, data: { deletedAt: null } });

/*
 * Purge is a REAL delete, and the cascades in schema.prisma are what make it
 * safe to be one line: a project takes its tasks, statuses, sprints and
 * members with it, a task takes its assignees, comments and activity.
 */
const purgeProject = (id) => prisma.project.delete({ where: { id } });

const purgeTask = (id) => prisma.task.delete({ where: { id } });

export default {
  findDeletedProjects,
  findDeletedTasks,
  findDeletedProject,
  findDeletedTask,
  membershipFor,
  restoreProject,
  restoreTask,
  purgeProject,
  purgeTask,
};
