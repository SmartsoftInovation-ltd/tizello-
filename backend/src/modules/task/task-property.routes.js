/**
 * Task property-definition endpoints, mounted at
 * `/api/v1/projects/:projectId/task-properties`.
 *
 * PROJECT-scoped, where `project-property.routes.js` is workspace-scoped: a
 * project's backlog is its own task database, so a column one team adds to its
 * tasks does not appear on every other project's.
 *
 * **Reading is open to the workspace; editing takes `requireProjectWrite`.**
 * Adding a column changes every task in the project, where filling one in
 * changes one task — so the schema sits one tier above the values, which ride
 * `PATCH /tasks/:taskId` behind the wider `requireProjectContribute`. Same
 * split, one level down, as the workspace's project schema.
 *
 * See docs/api/task.md
 */

import express from 'express';

import controller from './task-property.controller.js';
import {
  createTaskPropertySchema,
  updateTaskPropertySchema,
} from './task-property.validator.js';
import validate from '../../shared/middlewares/validate.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { authGuard } from '../../shared/middlewares/auth.js';
import { loadProject, requireProjectWrite } from '../../shared/middlewares/project.js';

// `mergeParams` is load-bearing: `:projectId` lives on the mount path, and
// without it `loadProject` sees no id and every request 400s.
const router = express.Router({ mergeParams: true });

router.get('/', authGuard, loadProject, asyncHandler(controller.list));

router.post(
  '/',
  authGuard,
  loadProject,
  requireProjectWrite,
  validate(createTaskPropertySchema),
  asyncHandler(controller.create)
);

router.patch(
  '/:propertyId',
  authGuard,
  loadProject,
  requireProjectWrite,
  validate(updateTaskPropertySchema),
  asyncHandler(controller.update)
);

router.delete(
  '/:propertyId',
  authGuard,
  loadProject,
  requireProjectWrite,
  asyncHandler(controller.remove)
);

export default router;
