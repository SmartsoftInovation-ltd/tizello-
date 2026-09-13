/**
 * Task endpoints, in **two scopes** — the same split `project.routes.js` makes.
 *
 * Create and list are project-scoped (`/api/v1/projects/:projectId/tasks`):
 * on create there is no task yet to authorise against, so the project has to be
 * in the path for `loadProject` to resolve the caller's roles.
 *
 * Everything else is task-scoped (`/api/v1/tasks/:taskId`): a task id is
 * globally unique, and `loadTask` resolves the project — and both roles — from
 * it, so a client never has to carry a project id it can read off the task.
 *
 * READS are open to anyone in the workspace; WRITES take
 * `requireProjectContribute`, which admits collaborators as well as managers —
 * see shared/middlewares/task.js for why that tier exists.
 *
 * No rate limiter, matching the project module's routes today; docs/api/task.md
 * §Rate limiting records it as a known gap rather than a decision.
 *
 * See docs/api/task.md
 */

import express from 'express';

import controller from './task.controller.js';
import { createTaskSchema, updateTaskSchema, listTasksQuerySchema } from './task.validator.js';
import validate from '../../shared/middlewares/validate.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { authGuard } from '../../shared/middlewares/auth.js';
import { loadProject } from '../../shared/middlewares/project.js';
import { loadTask, requireProjectContribute } from '../../shared/middlewares/task.js';

/* ── Project-scoped: /api/v1/projects/:projectId/tasks ──────────────────── */

// `mergeParams` is load-bearing: `:projectId` is on the mount path.
const projectRouter = express.Router({ mergeParams: true });

projectRouter.get(
  '/',
  authGuard,
  loadProject,
  validate(listTasksQuerySchema, 'query'),
  asyncHandler(controller.list)
);

projectRouter.post(
  '/',
  authGuard,
  loadProject,
  requireProjectContribute,
  validate(createTaskSchema),
  asyncHandler(controller.create)
);

/* ── Task-scoped: /api/v1/tasks ─────────────────────────────────────────── */

const taskRouter = express.Router();

taskRouter.get('/:taskId', authGuard, loadTask, asyncHandler(controller.getById));

taskRouter.patch(
  '/:taskId',
  authGuard,
  loadTask,
  requireProjectContribute,
  validate(updateTaskSchema),
  asyncHandler(controller.update)
);

taskRouter.delete(
  '/:taskId',
  authGuard,
  loadTask,
  requireProjectContribute,
  asyncHandler(controller.remove)
);

export { projectRouter, taskRouter };
