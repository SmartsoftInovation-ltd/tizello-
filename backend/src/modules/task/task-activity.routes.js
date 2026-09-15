/**
 * Activity endpoint, mounted at `/api/v1/tasks/:taskId/activity`.
 *
 * Read-only: entries are written by the task and comment services as a side
 * effect of changing a task, never by a client. Open to anyone who can read
 * the task — history is part of the task, and hiding who moved it from the
 * people who can see where it is would be an odd secret.
 *
 * See docs/api/task.md §Activity
 */

import express from 'express';

import controller from './task-activity.controller.js';
import { listActivityQuerySchema } from './task-activity.validator.js';
import validate from '../../shared/middlewares/validate.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { authGuard } from '../../shared/middlewares/auth.js';
import { loadTask } from '../../shared/middlewares/task.js';

// `mergeParams` is load-bearing: `:taskId` is on the mount path.
const router = express.Router({ mergeParams: true });

router.get(
  '/',
  authGuard,
  loadTask,
  validate(listActivityQuerySchema, 'query'),
  asyncHandler(controller.list)
);

export default router;
