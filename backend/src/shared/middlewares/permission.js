// Role-based authorization. Reads every decision out of
// shared/constants/roles.js — no role string is hard-coded here.
//
// All three middlewares must run AFTER authGuard (req.user) and after
// whatever populates req.membership for the workspace being acted on.
// `loadMembership` below is the scaffold's stub for that step: it is where
// the workspace-scoped role lookup goes once the membership module exists.

import AppError from '../utils/AppError.js';
import httpStatus from '../constants/httpStatus.js';
import asyncHandler from '../utils/asyncHandler.js';
import { membershipCan, roleAtLeast } from '../constants/roles.js';
import { AUTH_CODES } from '../constants/authCodes.js';
import prisma from '../../config/db.js';

// Resolves the caller's role in the workspace named by the route and puts it
// on req.membership. Kept in middleware (not in each service) so a route
// either declares its workspace scope or has none — there is no third state
// where a service half-checks.
const loadMembership = asyncHandler(async (req, res, next) => {
  const workspaceId = req.params.workspaceId ?? req.body.workspaceId;

  if (!workspaceId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'workspaceId is required', AUTH_CODES.VALIDATION_ERROR);
  }

  /* The custom role rides along, because `membershipCan` resolves the grant
     from it and every guard downstream asks that question. One include here
     beats a second query inside each middleware that needs it. */
  const membership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: { userId: req.user.id, workspaceId },
    },
    include: { customRole: { select: { id: true, name: true, permissions: true, baseRole: true } } },
  });

  // A non-member gets 404, not 403: confirming that a workspace exists to
  // someone with no access to it is itself a leak.
  if (!membership) {
    throw new AppError(httpStatus.NOT_FOUND, 'Workspace not found', AUTH_CODES.NOT_FOUND);
  }

  req.membership = membership;
  next();
});

// Requires the caller's MEMBERSHIP to hold `permission` (a value from
// PERMISSIONS in shared/constants/roles.js).
//
// Membership, not tier: a workspace-defined role carries its own grant, and
// `membershipCan` is what resolves which of the two applies. Passing
// `membership.role` here instead would silently ignore every custom role.
const requirePermission = (permission) => (req, res, next) => {
  if (!membershipCan(req.membership, permission)) {
    return next(
      new AppError(
        httpStatus.FORBIDDEN,
        'You do not have permission to perform this action',
        AUTH_CODES.FORBIDDEN
      )
    );
  }

  next();
};

// Requires the caller's workspace role to be exactly one of `roles`. Prefer
// requirePermission — this is for the rare check that is genuinely about
// identity rather than capability (e.g. "only the OWNER can transfer
// ownership").
const requireRole =
  (...roles) =>
  (req, res, next) => {
    const role = req.membership?.role;

    if (!role || !roles.includes(role)) {
      return next(
        new AppError(
        httpStatus.FORBIDDEN,
        'You do not have permission to perform this action',
        AUTH_CODES.FORBIDDEN
      )
      );
    }

    next();
  };

// Requires the caller's role to be at least `minimum` on the ROLE_ORDER
// ladder (MEMBER < ADMIN < OWNER).
const requireAtLeast = (minimum) => (req, res, next) => {
  if (!roleAtLeast(req.membership?.role, minimum)) {
    return next(
      new AppError(
        httpStatus.FORBIDDEN,
        'You do not have permission to perform this action',
        AUTH_CODES.FORBIDDEN
      )
    );
  }

  next();
};

export { loadMembership, requirePermission, requireRole, requireAtLeast };
