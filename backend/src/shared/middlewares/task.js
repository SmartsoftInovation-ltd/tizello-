/**
 * Task-scoped authorization: resolving `:taskId` to a task and the caller's
 * place in the project ladder around it.
 *
 * A file beside `project.js` rather than an addition to it, for the reason
 * `project.js` gives for not living inside `permission.js`: modules with no
 * concept of a task import that file, and this stays greppable on its own.
 *
 * ONE MIDDLEWARE, not three. `requireProjectContribute` and
 * `markProjectWriter` used to live here, because the task module was their
 * first caller — but neither knows what a task is, and chat is now the second
 * caller of both. They are in `project.js` with the rest of the ladder;
 * `docs/api/task.md` §Guards still describes the tier, and the argument for why
 * a task row takes the wider CONTRIBUTE tier rather than
 * `requireProjectWrite` moved there with it.
 *
 * What is left is genuinely task-scoped: resolving `:taskId` to a task plus the
 * caller's two roles, in ONE query rather than the resolver's two, because
 * every task route runs it.
 *
 * Runs AFTER `authGuard`.
 */

import AppError from '../utils/AppError.js';
import httpStatus from '../constants/httpStatus.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AUTH_CODES } from '../constants/authCodes.js';
import { projectAccessFlags, projectWithAccess, splitAccess } from '../services/project-access.js';
import prisma from '../../config/db.js';

// Every "you cannot see this" case — a deleted task, a task in a deleted
// project, a task in a workspace the caller is not in, an id that never
// existed — answers identically. Confirming existence is itself the leak.
const notFound = () => new AppError(httpStatus.NOT_FOUND, 'Task not found', AUTH_CODES.NOT_FOUND);

/**
 * Loads the task named by `:taskId`, its project, and both of the caller's
 * roles, and puts them on the request with the SAME names `loadProject` uses:
 *
 *   req.task          the task row (never soft-deleted)
 *   req.project       its project (never soft-deleted)
 *   req.membership    the caller's Membership in the project's workspace
 *   req.projectMember their ProjectMember row, or null
 *   req.projectRole   OWNER / MANAGER / COLLABORATOR / null
 *
 *   req.canContributeProject / req.canWriteProject  the same two flags
 *                     `loadProject` stamps, from the same function
 *
 * Reusing those names is what lets every guard in `project.js` run after this
 * middleware unchanged — the comment-delete rule needs `canWriteProject`, and
 * every task write needs `requireProjectContribute`.
 *
 * The flags come from `projectAccessFlags`, NOT from a second copy of the
 * ladder: this middleware has the project row already, so it computes the same
 * conclusions from the same inputs instead of re-reading it through
 * `resolveProjectAccess`. See that file's header for why the split is shaped
 * this way.
 */
const loadTask = asyncHandler(async (req, res, next) => {
  const { taskId } = req.params;

  if (!taskId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'taskId is required', AUTH_CODES.VALIDATION_ERROR);
  }

  /* One query: task, its project and both memberships — see
     `projectWithAccess` in shared/services/project-access.js. */
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, project: { deletedAt: null } },
    include: { project: projectWithAccess(req.user.id) },
  });

  if (!task) throw notFound();

  const { project: loaded, ...row } = task;
  const { project, membership } = splitAccess(loaded);

  if (!membership) throw notFound();

  const projectMember = project.members[0] ?? null;

  req.task = row;
  req.project = project;
  req.membership = membership;
  req.projectMember = projectMember;

  const flags = projectAccessFlags({
    project,
    membership,
    projectMember,
    userId: req.user.id,
  });

  req.projectRole = flags.projectRole;
  req.canContributeProject = flags.canContribute;
  req.canWriteProject = flags.canWrite;

  next();
});

export { loadTask };
