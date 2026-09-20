/**
 * The search endpoint — one route, one scope.
 *
 * NO `:workspaceId` AND NO `:projectId` IN THE PATH, unlike every other module
 * here. Those exist so `loadProject` / `loadWorkspace` can resolve the
 * caller's roles against the thing being addressed; search addresses nothing.
 * Its scope is "every workspace this caller belongs to", which the service
 * resolves from `req.user.id` — so a caller cannot even ASK about a workspace
 * they are not in.
 *
 * That is also why there is no `requireProjectRead` here: there is no single
 * project to check. The boundary is inside the queries instead
 * (`search.repository.js`), which is a stronger guarantee than a guard in
 * front of them — a row the caller may not see is never read at all.
 *
 * `searchLimiter` DOES apply, diverging from the project/task/sprint routes,
 * which ship no limiter. A substring match across three tables is a scan per
 * keystroke; see docs/api/search.md §Rate limiting.
 *
 * See docs/api/search.md
 */

import express from 'express';

import controller from './search.controller.js';
import { searchQuerySchema } from './search.validator.js';
import validate from '../../shared/middlewares/validate.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { authGuard } from '../../shared/middlewares/auth.js';
import { searchLimiter } from '../../shared/middlewares/rateLimiter.js';

const router = express.Router();

/* `authGuard` BEFORE `searchLimiter`, deliberately: the limiter keys on
   `req.user.id`, which does not exist until the guard has run. Reversed, every
   caller would silently share one IP-keyed budget. */
router.get('/', authGuard, searchLimiter, validate(searchQuerySchema, 'query'), asyncHandler(controller.search));

export default router;
