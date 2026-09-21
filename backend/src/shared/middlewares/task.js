/**
 * Task-scoped authorization: loading a task through the project ladder, and
 * the one permission tier the project module has no name for.
 *
 * A new file beside `project.js` rather than an addition to it, for the reason
 * `project.js` gives for not living inside `permission.js`: modules that have
 * no concept of a task import that file, and the task ladder is greppable on
 * its own.
 *
 * THE TIER: CONTRIBUTE. `project.js` has two — `requireProjectWrite` (workspace
 * OWNER/ADMIN, project owner, MANAGER) and `requireProjectOwner`. Neither fits
 * a task. A COLLABORATOR is somebody who was added to the project to do the
 * work, and a collaborator who can read the backlog but cannot file a task or
 * move one to Done is not collaborating. So task rows take the wider
 * `requireProjectContribute` — anyone with a `ProjectMember` row, plus the
 * workspace escape hatch — while the project's task SCHEMA (task properties)
 * stays behind `requireProjectWrite`, exactly as the workspace's project schema
 * stays behind `PROJECT_MANAGE_ANY`. docs/api/task.md §Guards.
 *
 * A workspace MEMBER who is not on the project stays read-only, which is the
 * same step 4 of the ladder `project.js` documents.
 *
 * All of these run AFTER `authGuard`.
 */

import AppError from '../utils/AppError.js';
import httpStatus from '../constants/httpStatus.js';
import asyncHandler from '../utils/asyncHandler.js';
import { PERMISSIONS, membershipCan } from '../constants/roles.js';
import { AUTH_CODES } from '../constants/authCodes.js';
import prisma from '../../config/db.js';

const FORBIDDEN = () =>
  new AppError(
    httpStatus.FORBIDDEN,
    'You do not have permission to perform this action',
    AUTH_CODES.FORBIDDEN
  );

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
 * Reusing those names is what lets `requireProjectWrite` from `project.js`
 * run after this middleware unchanged — the comment-delete rule needs it.
 */
const loadTask = asyncHandler(async (req, res, next) => {
  const { taskId } = req.params;

  if (!taskId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'taskId is required', AUTH_CODES.VALIDATION_ERROR);
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, project: { deletedAt: null } },
    include: {
      project: { include: { members: { where: { userId: req.user.id } } } },
    },
  });

  if (!task) throw notFound();

  const membership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: { userId: req.user.id, workspaceId: task.project.workspaceId },
    },
  });

  if (!membership) throw notFound();

  const { project, ...row } = task;
  const projectMember = project.members[0] ?? null;

  req.task = row;
  req.project = project;
  req.membership = membership;
  req.projectMember = projectMember;
  req.projectRole = project.ownerId === req.user.id ? 'OWNER' : (projectMember?.role ?? null);

  next();
});

/**
 * Workspace OWNER/ADMIN, the project owner, or anyone on the project —
 * MANAGER and COLLABORATOR alike. Runs after `loadProject` or `loadTask`.
 */
const requireProjectContribute = (req, res, next) => {
  const escalated = membershipCan(req.membership, PERMISSIONS.PROJECT_MANAGE_ANY);
  const owns = req.project?.ownerId === req.user.id;
  const onProject = Boolean(req.projectMember);

  if (!escalated && !owns && !onProject) return next(FORBIDDEN());

  next();
};

/**
 * Stamps `req.canWriteProject` — the `requireProjectWrite` rule as a flag
 * rather than a gate — and never rejects.
 *
 * For the one decision that is "the author, OR a project writer": deleting a
 * comment. A gate here would lock authors out of their own comments; checking
 * the rule in the service would put a role check in a service, which
 * `project.js` exists to prevent. The flag keeps the ladder in middleware and
 * leaves the author comparison — which needs the comment row — to the service.
 */
const markProjectWriter = (req, res, next) => {
  const escalated = membershipCan(req.membership, PERMISSIONS.PROJECT_MANAGE_ANY);
  const owns = req.project?.ownerId === req.user.id;
  const manages = req.projectMember?.role === 'MANAGER';

  req.canWriteProject = escalated || owns || manages;

  next();
};

export { loadTask, requireProjectContribute, markProjectWriter };
