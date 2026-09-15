/**
 * Sprint endpoints, in **two scopes** — the split `project.routes.js` and
 * `task.routes.js` make.
 *
 * Create and list are project-scoped (`/api/v1/projects/:projectId/sprints`):
 * on create there is no sprint yet, so the project must be in the path for
 * `loadProject` to resolve the caller's roles. Everything else is addressed by
 * the sprint's own id (`/api/v1/sprints/:sprintId`), and `loadSprint` resolves
 * the project and both roles from it.
 *
 * READS are open to anyone in the workspace. Every WRITE — create, edit, start,
 * complete, delete — takes `requireProjectWrite` (project owner, MANAGER,
 * workspace OWNER/ADMIN). Running the team's cadence is a lead's call, the
 * same tier that owns the project's statuses. Moving a TASK into or out of a
 * sprint is a task write and takes the task tier (`requireProjectContribute`);
 * see docs/api/sprint.md §Guards.
 *
 * No rate limiter, matching the project and task routes — the shared gap
 * docs/api/task.md §Rate limiting records.
 *
 * See docs/api/sprint.md
 */

import express from 'express';

import controller from './sprint.controller.js';
import {
  createSprintSchema,
  updateSprintSchema,
  startSprintSchema,
  listSprintsQuerySchema,
} from './sprint.validator.js';
import validate from '../../shared/middlewares/validate.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { authGuard } from '../../shared/middlewares/auth.js';
import { loadProject, requireProjectWrite } from '../../shared/middlewares/project.js';
import { loadSprint } from '../../shared/middlewares/sprint.js';

/* ── Project-scoped: /api/v1/projects/:projectId/sprints ────────────────── */

// `mergeParams` is load-bearing: `:projectId` is on the mount path.
const projectRouter = express.Router({ mergeParams: true });

projectRouter.get(
  '/',
  authGuard,
  loadProject,
  validate(listSprintsQuerySchema, 'query'),
  asyncHandler(controller.list)
);

projectRouter.post(
  '/',
  authGuard,
  loadProject,
  requireProjectWrite,
  validate(createSprintSchema),
  asyncHandler(controller.create)
);

/* ── Sprint-scoped: /api/v1/sprints ─────────────────────────────────────── */

const sprintRouter = express.Router();

sprintRouter.get('/:sprintId', authGuard, loadSprint, asyncHandler(controller.getById));

sprintRouter.patch(
  '/:sprintId',
  authGuard,
  loadSprint,
  requireProjectWrite,
  validate(updateSprintSchema),
  asyncHandler(controller.update)
);

sprintRouter.post(
  '/:sprintId/start',
  authGuard,
  loadSprint,
  requireProjectWrite,
  validate(startSprintSchema),
  asyncHandler(controller.start)
);

sprintRouter.post('/:sprintId/complete', authGuard, loadSprint, requireProjectWrite, asyncHandler(controller.complete));

sprintRouter.delete('/:sprintId', authGuard, loadSprint, requireProjectWrite, asyncHandler(controller.remove));

export { projectRouter, sprintRouter };
