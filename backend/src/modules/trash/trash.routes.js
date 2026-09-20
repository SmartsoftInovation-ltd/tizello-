/**
 * Trash endpoints — one list, two restores, two purges.
 *
 * NO `:workspaceId` AND NO `:projectId` IN ANY PATH, like the search module.
 * The trash is not a place inside a project; it is everything of the caller's
 * that is gone, wherever it lived. Its scope comes from the session, so there
 * is no id a caller could name to ask about somebody else's deletions.
 *
 * That is also why there is no `loadProject` / `loadTask` here, and this one is
 * forced rather than stylistic: both of those middlewares filter
 * `deletedAt: null`, because everywhere else a deleted row must be invisible.
 * They cannot load the rows this module exists to act on. The equivalent
 * checks live in `trash.service.js`, which mirrors their ladders exactly.
 *
 * RESTORE IS `POST`, NOT `PATCH`. It is not a field being edited — it is an
 * operation with one meaning, the same shape `/sprints/:id/start` takes. Purge
 * is `DELETE` on the entry, which is the one place in this app where DELETE
 * really does destroy the row.
 *
 * See docs/api/trash.md
 */

import express from 'express';

import controller from './trash.controller.js';
import { idParamSchema, trashQuerySchema } from './trash.validator.js';
import validate from '../../shared/middlewares/validate.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { authGuard } from '../../shared/middlewares/auth.js';

const router = express.Router();

router.get('/', authGuard, validate(trashQuerySchema, 'query'), asyncHandler(controller.list));

router.post(
  '/projects/:id/restore',
  authGuard,
  validate(idParamSchema, 'params'),
  asyncHandler(controller.restoreProject)
);

router.post(
  '/tasks/:id/restore',
  authGuard,
  validate(idParamSchema, 'params'),
  asyncHandler(controller.restoreTask)
);

router.delete(
  '/projects/:id',
  authGuard,
  validate(idParamSchema, 'params'),
  asyncHandler(controller.purgeProject)
);

router.delete('/tasks/:id', authGuard, validate(idParamSchema, 'params'), asyncHandler(controller.purgeTask));

export default router;
