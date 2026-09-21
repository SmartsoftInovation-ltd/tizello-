/**
 * Project-scoped authorization. Resolves the two-layer ladder — the caller's
 * WORKSPACE role and their PROJECT role — once, in one place, so no service
 * anywhere grows an `if (role === …)` of its own.
 *
 * A new file rather than an addition to `permission.js`: that file is
 * workspace-scoped by construction and is imported by modules with no concept
 * of a project. Keeping the project ladder beside it, not inside it, leaves
 * both greppable.
 *
 * The ladder, in fixed order (see .claude/plan/project.md §2.5):
 *
 *   1. no workspace membership -> 404. A non-member never learns the project
 *      exists; confirming existence is itself the leak, exactly as
 *      `loadMembership` argues.
 *   2. workspace OWNER/ADMIN (PROJECT_MANAGE_ANY) -> full access to every
 *      project in the workspace. Without this escape hatch a workspace admin
 *      can be locked out of a project in their own workspace by a collaborator
 *      who removes them, recoverable only from the database.
 *   3. otherwise the project role decides — owner and MANAGER may write.
 *   4. workspace MEMBER with no ProjectMember row -> read-only. Projects are
 *      visible workspace-wide; there is no private-project flag in this schema.
 *
 * **Ownership is read from `req.project.ownerId` and nowhere else.** The
 * `ProjectMember` row with `role: OWNER` is a mirror kept for display (plan
 * §2.4); a `projectMember.role === 'OWNER'` check in this file would be a bug.
 *
 * All three run AFTER `authGuard`.
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

// The one 404 every "you cannot see this" case collapses into: a soft-deleted
// project, a project in someone else's workspace, and an id that never existed
// all answer identically.
const notFound = () =>
  new AppError(httpStatus.NOT_FOUND, 'Project not found', AUTH_CODES.NOT_FOUND);

/**
 * Loads the project named by the route plus both of the caller's roles, and
 * puts them on the request:
 *
 *   req.project       the row (never soft-deleted)
 *   req.membership    their Membership in the project's workspace
 *   req.projectMember their ProjectMember row, or null
 *   req.projectRole   the effective role for the DTO — OWNER / MANAGER /
 *                     COLLABORATOR / null
 */
const loadProject = asyncHandler(async (req, res, next) => {
  const { projectId } = req.params;

  if (!projectId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'projectId is required',
      AUTH_CODES.VALIDATION_ERROR
    );
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: { members: { where: { userId: req.user.id } } },
  });

  if (!project) throw notFound();

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: project.workspaceId } },
  });

  // Not a member of the workspace the project lives in: same 404 as a project
  // that does not exist, never a 403.
  if (!membership) throw notFound();

  const projectMember = project.members[0] ?? null;

  req.project = project;
  req.membership = membership;
  req.projectMember = projectMember;
  req.projectRole =
    project.ownerId === req.user.id ? 'OWNER' : (projectMember?.role ?? null);

  next();
});

/** Step 2 or 3 of the ladder: workspace OWNER/ADMIN, the project owner, or a MANAGER. */
const requireProjectWrite = (req, res, next) => {
  const escalated = membershipCan(req.membership, PERMISSIONS.PROJECT_MANAGE_ANY);
  const owns = req.project?.ownerId === req.user.id;
  const manages = req.projectMember?.role === 'MANAGER';

  if (!escalated && !owns && !manages) return next(FORBIDDEN());

  next();
};

/** Stricter: workspace OWNER/ADMIN or the project owner. A MANAGER is not enough. */
const requireProjectOwner = (req, res, next) => {
  const escalated = membershipCan(req.membership, PERMISSIONS.PROJECT_MANAGE_ANY);
  const owns = req.project?.ownerId === req.user.id;

  if (!escalated && !owns) return next(FORBIDDEN());

  next();
};

export { loadProject, requireProjectWrite, requireProjectOwner };
