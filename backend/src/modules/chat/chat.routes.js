/**
 * Chat's REST surface, mounted at `/api/v1/workspaces/:workspaceId/messages`
 * from `src/routes/index.js`.
 *
 * ONE CHANNEL PER WORKSPACE, so one mount. There was briefly a second, for a
 * per-project channel; it was removed with the feature. If project chat ever
 * returns, this file becomes a factory again and the service grows the second
 * access rule — the shape is in git history, not in a parameter nobody passes.
 *
 * **HISTORY AND THE UNREAD WATERMARK. NOTHING ELSE.** Live messages arrive over
 * the `/chat` socket namespace; this is what a client calls when it opens the
 * channel or scrolls up. There is deliberately no `POST /messages` — see
 * `chat.controller.js`.
 *
 * **GUARDS STOP AT `authGuard`, AND THE GATE IS THE SERVICE.** No
 * `loadMembership`: that middleware answers `403`, and for a channel the answer
 * has to be `404` — a `403` confirms to somebody with no access that the
 * conversation exists. The service applies the identical membership check and
 * returns the `404` a missing workspace would give.
 *
 * It also keeps the two transports honest: the socket half has no middleware to
 * hang a guard on, so putting the gate in the service is what makes "the REST
 * check mirrors the socket one" true by construction rather than by inspection.
 *
 * `mergeParams` is load-bearing: `:workspaceId` is on the mount path.
 *
 * See docs/api/chat.md §4
 */

import express from 'express';

import controller from './chat.controller.js';
import { historyQuerySchema, markReadSchema } from './chat.validator.js';
import validate from '../../shared/middlewares/validate.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { authGuard } from '../../shared/middlewares/auth.js';
import { apiLimiter } from '../../shared/middlewares/rateLimiter.js';

const router = express.Router({ mergeParams: true });

/* No limiter on the reads, for the reason `notification.routes.js` gives:
   these are what a client calls on every navigation into a workspace, and
   rate-limiting an ambient surface turns a busy tab into a 429. The socket half
   has its own per-connection token bucket, which is where the writes are.
   docs/api/chat.md §Rate limiting. */
router.get('/', authGuard, validate(historyQuerySchema, 'query'), asyncHandler(controller.list));

router.get('/unread-count', authGuard, asyncHandler(controller.unreadCount));

/* The one write here, and it is a watermark rather than content: limited,
   because a client with a bug can call it on every scroll event. */
router.post(
  '/read',
  apiLimiter,
  authGuard,
  validate(markReadSchema),
  asyncHandler(controller.markRead),
);

export default router;
