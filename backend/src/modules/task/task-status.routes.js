/**
 * A project's editable task statuses, mounted at
 * `/api/v1/projects/:projectId/task-statuses`.
 *
 * READ is open to the whole workspace, like the tasks it labels. Every WRITE
 * takes `requireProjectWrite`: the status list is the project's workflow, the
 * same kind of schema as task properties, so a collaborator may move a task to
 * "Review" but may not invent "Review". Moving a task is `PATCH /tasks/:id`,
 * behind the wider `requireProjectContribute`.
 *
 * `PUT /order` is declared BEFORE the `/:statusId` routes. Express matches in
 * order, and there is no PUT on `/:statusId` today — but the day one is added,
 * "order" would be captured as a status id if this line sat below it.
 *
 * See docs/api/task.md §Statuses
 */

import express from 'express';

import controller from './task-status.controller.js';
import {
  createTaskStatusSchema,
  updateTaskStatusSchema,
  reorderTaskStatusesSchema,
} from './task-status.validator.js';
import validate from '../../shared/middlewares/validate.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { authGuard } from '../../shared/middlewares/auth.js';
import { loadProject, requireProjectWrite } from '../../shared/middlewares/project.js';

// `mergeParams` is load-bearing: `:projectId` lives on the mount path.
const router = express.Router({ mergeParams: true });

router.get('/', authGuard, loadProject, asyncHandler(controller.list));

router.post(
  '/',
  authGuard,
  loadProject,
  requireProjectWrite,
  validate(createTaskStatusSchema),
  asyncHandler(controller.create)
);

router.put(
  '/order',
  authGuard,
  loadProject,
  requireProjectWrite,
  validate(reorderTaskStatusesSchema),
  asyncHandler(controller.reorder)
);

router.patch(
  '/:statusId',
  authGuard,
  loadProject,
  requireProjectWrite,
  validate(updateTaskStatusSchema),
  asyncHandler(controller.update)
);

router.delete(
  '/:statusId',
  authGuard,
  loadProject,
  requireProjectWrite,
  asyncHandler(controller.remove)
);

export default router;
