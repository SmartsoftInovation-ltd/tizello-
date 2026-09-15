/**
 * Comment endpoints, mounted at `/api/v1/tasks/:taskId/comments`.
 *
 * A router of its own rather than three more routes on `task.routes.js`'s
 * `taskRouter`, so the task module's routes file lists tasks and nothing else.
 * `mergeParams` is what makes `:taskId` from the mount path visible here.
 *
 * Reading a thread is open to anyone who can read the task. Posting takes
 * `requireProjectContribute` — the same tier as editing the task, because a
 * comment is part of working on it. Deleting takes only `loadTask` plus
 * `markProjectWriter`: whether the caller may delete depends on who wrote the
 * comment, which only the service can see. Editing takes contribute plus an
 * author-only check in the service.
 *
 * See docs/api/task.md
 */

import express from 'express';

import controller from './task-comment.controller.js';
import { createCommentSchema, updateCommentSchema } from './task-comment.validator.js';
import validate from '../../shared/middlewares/validate.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { authGuard } from '../../shared/middlewares/auth.js';
import {
  loadTask,
  markProjectWriter,
  requireProjectContribute,
} from '../../shared/middlewares/task.js';

const router = express.Router({ mergeParams: true });

router.get('/', authGuard, loadTask, asyncHandler(controller.list));

router.post(
  '/',
  authGuard,
  loadTask,
  requireProjectContribute,
  validate(createCommentSchema),
  asyncHandler(controller.create)
);

// Contribute, then the author check in the service: someone removed from the
// project can no longer rewrite what they said on it.
router.patch(
  '/:commentId',
  authGuard,
  loadTask,
  requireProjectContribute,
  validate(updateCommentSchema),
  asyncHandler(controller.update)
);

router.delete(
  '/:commentId',
  authGuard,
  loadTask,
  markProjectWriter,
  asyncHandler(controller.remove)
);

export default router;
