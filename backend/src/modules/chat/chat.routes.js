/**
 * Chat's REST surface. TWO ROUTERS, ONE MODULE:
 *
 *   /api/v1/workspaces/:workspaceId/messages   the workspace channel
 *   /api/v1/projects/:projectId/messages       one project's channel
 *
 * The same four handlers serve both — the path names the target and
 * `chat.service.js#resolveChannel` owns the access rule for each kind. Two
 * mounts for one module is the pattern `project.routes.js` and
 * `invitation.routes.js` already use, and for the same reason: the resource is
 * one thing addressed two ways.
 *
 * **HISTORY AND THE UNREAD WATERMARK. NOTHING ELSE.** Live messages arrive over
 * the `/chat` socket namespace; this is what a client calls when it opens a
 * channel or scrolls up. There is deliberately no `POST /messages` — see
 * `chat.controller.js`.
 *
 * **GUARDS STOP AT `authGuard`, AND THE GATE IS THE SERVICE.** No
 * `loadMembership`, no `loadProject`, no `requireProjectContribute`: those
 * middlewares answer `403`, and for a channel the answer has to be `404` —
 * `403` confirms to somebody with no access that the conversation exists. The
 * service applies the identical ladders (every member for a workspace channel,
 * the contribute tier for a project one) and returns the `404` a missing
 * workspace or project would give.
 *
 * It also keeps the two transports honest: the socket half has no middleware
 * to hang a guard on, so putting the gate in the service is what makes "the
 * REST check mirrors the socket one" true by construction rather than by
 * inspection.
 *
 * `mergeParams` is load-bearing on both: the id is on the mount path.
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

/** The four routes, mounted twice. Written once so the two cannot drift. */
const channelRouter = () => {
  const router = express.Router({ mergeParams: true });

  /* No limiter on the reads, for the reason `notification.routes.js` gives:
     these are what a client calls on every navigation into a workspace or
     project, and rate-limiting an ambient surface turns a busy tab into a 429.
     The socket half has its own per-connection token bucket, which is where
     the writes are. docs/api/chat.md §Rate limiting. */
  router.get('/', authGuard, validate(historyQuerySchema, 'query'), asyncHandler(controller.list));

  /* The channel's id, which is what a client needs before it can join a socket
     room. Separate from the history read because a client that already holds
     the id — every navigation after the first — should not re-read a page of
     messages to learn it again. */
  router.get('/channel', authGuard, asyncHandler(controller.channel));

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

  return router;
};

const workspaceRouter = channelRouter();
const projectRouter = channelRouter();

export { workspaceRouter, projectRouter };
export default projectRouter;
