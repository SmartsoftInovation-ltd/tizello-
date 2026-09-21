/**
 * Role endpoints, mounted at `/api/v1/workspaces/:workspaceId/roles` from
 * `src/routes/index.js`.
 *
 * Workspace-scoped by necessity, not by taste: `permission.js` resolves the
 * caller's membership from `(userId, workspaceId)`, so the workspace has to be
 * in the path for the permission check to have anything to check against.
 *
 * `mergeParams` is load-bearing — without it `req.params.workspaceId` is
 * undefined inside this router, so `loadMembership` cannot resolve a membership
 * and every request 400s on a workspace id that is visibly right there in the
 * URL. The same trap `member.routes.js` documents.
 *
 * THE READS ARE GATED ON `MEMBER_VIEW`, NOT `ROLE_MANAGE`. Anyone who can see
 * the roster can see what the roles mean — a workspace where only admins may
 * read the permission matrix is one where nobody else can find out why an
 * action was refused. Writing a role is the privileged half.
 *
 * Order on every write: limiter → guard → params → membership → permission →
 * body. The limiter runs before anything can reject, and body validation runs
 * LAST so a caller who may not act here is refused before their payload is
 * parsed — matching `member.routes.js`.
 *
 * See docs/api/role.md
 */

import express from 'express';

import controller from './role.controller.js';
import {
  createRoleSchema,
  updateRoleSchema,
  roleParamsSchema,
  workspaceParamsSchema,
} from './role.validator.js';
import validate from '../../shared/middlewares/validate.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { authGuard } from '../../shared/middlewares/auth.js';
import { loadMembership, requirePermission } from '../../shared/middlewares/permission.js';
import { apiLimiter } from '../../shared/middlewares/rateLimiter.js';
import { PERMISSIONS } from '../../shared/constants/roles.js';

const router = express.Router({ mergeParams: true });

router.get(
  '/permissions',
  authGuard,
  validate(workspaceParamsSchema, 'params'),
  loadMembership,
  requirePermission(PERMISSIONS.MEMBER_VIEW),
  asyncHandler(controller.catalog)
);

router.get(
  '/',
  authGuard,
  validate(workspaceParamsSchema, 'params'),
  loadMembership,
  requirePermission(PERMISSIONS.MEMBER_VIEW),
  asyncHandler(controller.list)
);

router.post(
  '/',
  apiLimiter,
  authGuard,
  validate(workspaceParamsSchema, 'params'),
  loadMembership,
  requirePermission(PERMISSIONS.ROLE_MANAGE),
  validate(createRoleSchema),
  asyncHandler(controller.create)
);

router.patch(
  '/:roleId',
  apiLimiter,
  authGuard,
  validate(roleParamsSchema, 'params'),
  loadMembership,
  requirePermission(PERMISSIONS.ROLE_MANAGE),
  validate(updateRoleSchema),
  asyncHandler(controller.update)
);

router.delete(
  '/:roleId',
  apiLimiter,
  authGuard,
  validate(roleParamsSchema, 'params'),
  loadMembership,
  requirePermission(PERMISSIONS.ROLE_MANAGE),
  asyncHandler(controller.remove)
);

export default router;
