/**
 * Trash business rules: what is in it, who may put something back, and who may
 * destroy it for good. Throws `AppError`; never touches `res`.
 *
 * RESTORING TAKES EXACTLY THE AUTHORITY DELETING TOOK. A project is deleted by
 * a workspace OWNER/ADMIN or the project's owner (`requireProjectOwner`), so
 * those are the people who can bring it back; a task is deleted by anyone who
 * can contribute to its project (`requireProjectContribute`), so the same tier
 * restores it. Any other answer is wrong in one of two ways: a lower bar means
 * someone can undo a decision they could not have made, and a higher bar means
 * a deletion nobody present can reverse.
 *
 * PURGE TAKES THE SAME AUTHORITY AS RESTORE, not more. It is tempting to
 * reserve "delete forever" for owners, but the row is already deleted — the
 * destructive act happened, and purging only gives up the ability to undo it.
 * Gating it higher would leave contributors with a trash they can fill and
 * never empty.
 *
 * THE GUARDS ARE HERE, NOT IN MIDDLEWARE, and that is forced rather than
 * chosen: `loadProject` and `loadTask` both filter `deletedAt: null`, because
 * everywhere else a deleted row must be invisible. They cannot load the rows
 * this module exists to act on.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/trash.md
 */

import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import { AUTH_CODES } from '../../shared/constants/authCodes.js';
import { PERMISSIONS, membershipCan } from '../../shared/constants/roles.js';
import dto from './trash.dto.js';
import repository from './trash.repository.js';

/* One 404 for "gone", "never existed" and "not yours" alike — the same
   collapse `shared/middlewares/project.js` documents. Answering 403 for the
   last case would confirm the id belongs to something real. */
const notFound = () => new AppError(httpStatus.NOT_FOUND, 'Not found in trash', AUTH_CODES.NOT_FOUND);

const forbidden = () =>
  new AppError(httpStatus.FORBIDDEN, 'You do not have permission to perform this action', AUTH_CODES.FORBIDDEN);

/**
 * Workspace OWNER/ADMIN, or the project's owner. Mirrors `requireProjectOwner`.
 *
 * Takes the MEMBERSHIP, not its tier: a workspace-defined role carries its own
 * grant, and passing `membership.role` would resolve the tier's default and
 * quietly disagree with the endpoint that actually enforces.
 */
const canManageProject = (project, membership, userId) =>
  membershipCan(membership, PERMISSIONS.PROJECT_MANAGE_ANY) || project.ownerId === userId;

/** The above, plus anyone with a `ProjectMember` row. Mirrors `requireProjectContribute`. */
const canContribute = (project, membership, userId) =>
  canManageProject(project, membership, userId) || (project.members?.length ?? 0) > 0;

/**
 * Everything the caller could put back, newest deletion first.
 *
 * Each row carries `canRestore`, resolved per item rather than per request:
 * one caller can be a workspace ADMIN in one workspace and a plain member in
 * another, so a single flag for the whole list would be wrong for half of it.
 * The client draws the button from it, and the endpoint still enforces —
 * the flag is a courtesy, never the control.
 */
const listTrash = async (user, { limit }) => {
  const [projects, tasks] = await Promise.all([
    repository.findDeletedProjects(user.id, limit),
    repository.findDeletedTasks(user.id, limit),
  ]);

  /* One membership read per workspace involved, not per row: a trash holding
     forty tasks from three projects in one workspace is three lookups
     otherwise, and forty with the obvious loop. */
  const workspaceIds = [...new Set([...projects.map((p) => p.workspaceId), ...tasks.map((t) => t.project.workspaceId)])];
  const memberships = new Map(
    await Promise.all(
      workspaceIds.map(async (id) => [id, await repository.membershipFor(user.id, id)])
    )
  );

  return {
    projects: projects.map((project) =>
      dto.toProjectEntry(project, canManageProject(project, memberships.get(project.workspaceId), user.id))
    ),
    tasks: tasks.map((task) =>
      dto.toTaskEntry(task, canContribute(task.project, memberships.get(task.project.workspaceId), user.id))
    ),
  };
};

/* Both actions resolve the row and the caller's authority the same way, so
   they share one loader rather than repeating the 404/403 ladder twice. */
const loadProjectFor = async (projectId, user) => {
  const project = await repository.findDeletedProject(projectId, user.id);
  if (!project) throw notFound();

  const membership = await repository.membershipFor(user.id, project.workspaceId);
  if (!canManageProject(project, membership, user.id)) throw forbidden();

  return project;
};

const loadTaskFor = async (taskId, user) => {
  const task = await repository.findDeletedTask(taskId, user.id);
  if (!task) throw notFound();

  const membership = await repository.membershipFor(user.id, task.project.workspaceId);
  if (!canContribute(task.project, membership, user.id)) throw forbidden();

  return task;
};

const restoreProject = async (projectId, user) => {
  const project = await loadProjectFor(projectId, user);
  const restored = await repository.restoreProject(project.id);

  return { project: dto.toProjectEntry({ ...project, ...restored }, true) };
};

const restoreTask = async (taskId, user) => {
  const task = await loadTaskFor(taskId, user);
  const restored = await repository.restoreTask(task.id);

  return { task: dto.toTaskEntry({ ...task, ...restored }, true) };
};

const purgeProject = async (projectId, user) => {
  const project = await loadProjectFor(projectId, user);
  await repository.purgeProject(project.id);

  return { id: project.id, purged: true };
};

const purgeTask = async (taskId, user) => {
  const task = await loadTaskFor(taskId, user);
  await repository.purgeTask(task.id);

  return { id: task.id, purged: true };
};

export default { listTrash, restoreProject, restoreTask, purgeProject, purgeTask };
export { canManageProject, canContribute };
