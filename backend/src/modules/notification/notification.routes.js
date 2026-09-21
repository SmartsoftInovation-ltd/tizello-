/**
 * Notification endpoints, mounted at `/api/v1/notifications` from
 * `src/routes/index.js`.
 *
 * **NOT workspace-scoped, and this is the one module where that is the whole
 * point.** Every other resource lives inside a workspace and takes
 * `loadMembership` → `requirePermission`. A notification belongs to a person,
 * who may be in five workspaces and wants one bell, so the owner is
 * `req.user.id` and the scope is the `where` clause in every repository query.
 * There is no `:userId` in any path here: a route that took one would be a
 * route somebody could change.
 *
 * `authGuard` alone is therefore the complete guard.
 *
 * See docs/api/notification.md
 */

import express from 'express';

import controller from './notification.controller.js';
import { listQuerySchema, notificationParamsSchema } from './notification.validator.js';
import validate from '../../shared/middlewares/validate.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { authGuard } from '../../shared/middlewares/auth.js';
import { apiLimiter } from '../../shared/middlewares/rateLimiter.js';

const router = express.Router();

// No limiter on the reads. The bell re-reads on every navigation through the
// shell today, and is the obvious place to add polling or an event stream
// later — rate-limiting the one surface meant to be ambient would turn a busy
// tab into a 429 the moment either lands.
router.get('/', authGuard, validate(listQuerySchema, 'query'), asyncHandler(controller.list));

router.get('/unread-count', authGuard, asyncHandler(controller.unreadCount));

router.post('/read-all', apiLimiter, authGuard, asyncHandler(controller.markAllRead));

router.patch(
  '/:notificationId/read',
  apiLimiter,
  authGuard,
  validate(notificationParamsSchema, 'params'),
  asyncHandler(controller.markRead)
);

export default router;
