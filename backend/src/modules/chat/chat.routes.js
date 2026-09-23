/**
 * Chat's REST surface, mounted at `/api/v1/projects/:projectId/messages` from
 * `src/routes/index.js`.
 *
 * **HISTORY AND THE UNREAD WATERMARK. NOTHING ELSE.** Live messages arrive over
 * the `/chat` socket namespace; this router is what a client calls when it opens
 * a channel or scrolls up. There is deliberately no `POST /messages` — see
 * `chat.controller.js`.
 *
 * Guards: `authGuard` → `loadProject`, and then **the service**, which is where
 * this module's chain deliberately stops short of every other module's.
 *
 * WHY NOT `requireProjectContribute` HERE. The tier is the same one — a chat
 * message is the same kind of write as a task row, and a workspace member who
 * is not on the project may not read the channel (docs/api/chat.md §1). But
 * that middleware answers `403`, and for a channel the answer has to be `404`:
 * `403` confirms to somebody with no access that the project has a
 * conversation, which is the leak §1 refuses. `chat.service.js#requireChannel`
 * applies the identical ladder — it reads `canContribute` off the same
 * resolver — and turns a refusal into the same `404` a non-existent project
 * gets.
 *
 * It also keeps the two transports honest. The socket half has no middleware
 * to hang a guard on, so putting the gate in the service is what makes "the
 * REST check mirrors the socket one" true by construction rather than by
 * inspection.
 *
 * `mergeParams` is load-bearing: `:projectId` is on the mount path.
 *
 * See docs/api/chat.md §4
 */

import express from 'express';

import controller from './chat.controller.js';
import { historyQuerySchema, markReadSchema } from './chat.validator.js';
import validate from '../../shared/middlewares/validate.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { authGuard } from '../../shared/middlewares/auth.js';
import { loadProject } from '../../shared/middlewares/project.js';
import { apiLimiter } from '../../shared/middlewares/rateLimiter.js';

const router = express.Router({ mergeParams: true });

/* No limiter on the two reads, for the reason `notification.routes.js` gives:
   these are what a client calls on every navigation into a project, and
   rate-limiting an ambient surface turns a busy tab into a 429. The socket
   half has its own per-connection token bucket, which is where the writes
   are. docs/api/chat.md §Rate limiting. */
router.get(
  '/',
  authGuard,
  loadProject,
  validate(historyQuerySchema, 'query'),
  asyncHandler(controller.list)
);

router.get(
  '/unread-count',
  authGuard,
  loadProject,
  asyncHandler(controller.unreadCount)
);

/* The one write here, and it is a watermark rather than content: limited,
   because a client with a bug can call it on every scroll event. */
router.post(
  '/read',
  apiLimiter,
  authGuard,
  loadProject,
  validate(markReadSchema),
  asyncHandler(controller.markRead)
);

export default router;
