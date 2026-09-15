/**
 * Sprint-scoped loading: resolves the sprint named by `:sprintId`, its project,
 * and both of the caller's roles.
 *
 * A file beside `project.js` and `task.js`, for the reason each of those gives:
 * modules with no concept of a sprint import those files, and this ladder is
 * greppable on its own.
 *
 * It puts the project and roles on the request under the SAME names
 * `loadProject` uses, which is what lets `requireProjectWrite` run after it
 * unchanged. Every "you cannot see this" case — a sprint in a deleted project,
 * in a workspace the caller is not in, an id that never existed — is the same
 * 404, never a 403: confirming existence is itself the leak.
 *
 * Runs AFTER `authGuard`.
 *
 * See docs/api/sprint.md §Guards
 */

import AppError from '../utils/AppError.js';
import httpStatus from '../constants/httpStatus.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AUTH_CODES } from '../constants/authCodes.js';
import prisma from '../../config/db.js';

const notFound = () => new AppError(httpStatus.NOT_FOUND, 'Sprint not found', AUTH_CODES.NOT_FOUND);

/**
 *   req.sprint        the sprint row
 *   req.project       its project (never soft-deleted)
 *   req.membership    the caller's Membership in the project's workspace
 *   req.projectMember their ProjectMember row, or null
 *   req.projectRole   OWNER / MANAGER / COLLABORATOR / null
 */
const loadSprint = asyncHandler(async (req, res, next) => {
  const { sprintId } = req.params;

  if (!sprintId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'sprintId is required', AUTH_CODES.VALIDATION_ERROR);
  }

  const sprint = await prisma.sprint.findFirst({
    where: { id: sprintId, project: { deletedAt: null } },
    include: { project: { include: { members: { where: { userId: req.user.id } } } } },
  });

  if (!sprint) throw notFound();

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: sprint.project.workspaceId } },
  });

  if (!membership) throw notFound();

  const { project, ...row } = sprint;
  const projectMember = project.members[0] ?? null;

  req.sprint = row;
  req.project = project;
  req.membership = membership;
  req.projectMember = projectMember;
  req.projectRole = project.ownerId === req.user.id ? 'OWNER' : (projectMember?.role ?? null);

  next();
});

export { loadSprint };
