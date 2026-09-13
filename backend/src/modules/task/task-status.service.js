/**
 * Business rules for a project's editable task statuses, plus the resolver the
 * task service calls whenever a task is given a status.
 *
 * **Authorization is not this file's job.** `loadProject` and — for every
 * write — `requireProjectWrite` have already run. Editing the WORKFLOW is a
 * project writer's call, the same tier as task properties; moving a TASK
 * between statuses is a task write and stays with `requireProjectContribute`.
 *
 * Invariants this file holds:
 *   - every project has statuses: `ensureDefaults` seeds the three defaults on
 *     first use, so projects created after the migration need no hook in the
 *     project module;
 *   - exactly one default per project: set in one transaction, never deletable;
 *   - no task is ever orphaned: deleting a status moves its tasks to the default.
 *
 * See docs/api/task.md §Statuses
 */

import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import { AUTH_CODES } from '../../shared/constants/authCodes.js';
import { DEFAULT_STATUSES, POSITION_STEP } from '../../shared/constants/taskStatus.js';
import repository from './task-status.repository.js';
import dto from './task-status.dto.js';

const notFound = () =>
  new AppError(httpStatus.NOT_FOUND, 'Status not found', AUTH_CODES.NOT_FOUND);

const conflict = (name) =>
  new AppError(
    httpStatus.CONFLICT,
    `A status called "${name}" already exists in this project`,
    AUTH_CODES.CONFLICT
  );

const unprocessable = (message) =>
  new AppError(httpStatus.UNPROCESSABLE_ENTITY, message, AUTH_CODES.VALIDATION_ERROR);

/** Seeds the three defaults the first time a project's statuses are needed. A no-op on every call after. */
const ensureDefaults = async (projectId) => {
  const count = await repository.countForProject(projectId);
  if (count === 0) await repository.createDefaults(projectId, DEFAULT_STATUSES);
};

/** `GET /projects/:projectId/task-statuses`. */
const listStatuses = async (projectId) => {
  await ensureDefaults(projectId);
  const rows = await repository.findStatusesForProject(projectId);

  return rows.map(dto.toStatus);
};

/** `POST`. Appended to the end of its group; never the default — that is an explicit PATCH. */
const createStatus = async (projectId, { name, color, group }) => {
  await ensureDefaults(projectId);
  const last = await repository.lastPositionInGroup(projectId, group);

  try {
    const row = await repository.createStatus({
      projectId,
      name,
      color,
      group,
      position: last + POSITION_STEP,
      isDefault: false,
    });
    return dto.toStatus(row);
  } catch (error) {
    if (error?.code === 'P2002') throw conflict(name);
    throw error;
  }
};

/** `PATCH /:statusId`. Rename, recolour, or become the default. */
const updateStatus = async (projectId, statusId, patch) => {
  const existing = await repository.findStatus(projectId, statusId);
  if (!existing) throw notFound();

  try {
    const row = await repository.updateStatus(projectId, statusId, patch);
    return dto.toStatus(row);
  } catch (error) {
    if (error?.code === 'P2002') throw conflict(patch.name);
    throw error;
  }
};

/**
 * `PUT /order`. The FULL list, in display order, with each status's group.
 *
 * A whole list rather than "move X after Y" because a drag-and-drop that fires
 * two requests (a drop, then a correction) must end in the state of the last
 * one, not in a merge of both — replaying this call is idempotent. A partial
 * list is refused rather than merged: a status missing from it would have no
 * position to take.
 *
 * Moving a status to another group does NOT restamp its tasks' `completedAt`:
 * that field records when a task was finished, and rearranging the workflow
 * afterwards does not change when that was.
 */
const reorderStatuses = async (projectId, entries) => {
  await ensureDefaults(projectId);
  const current = await repository.findStatusesForProject(projectId);
  const known = new Set(current.map((status) => status.id));
  const sent = new Set(entries.map((entry) => entry.id));

  const complete =
    entries.length === current.length &&
    sent.size === entries.length &&
    entries.every((entry) => known.has(entry.id));
  if (!complete) throw unprocessable('Send every status exactly once');

  const nextInGroup = {};
  const positioned = entries.map(({ id, group }) => {
    nextInGroup[group] = (nextInGroup[group] ?? 0) + 1;
    return { id, group, position: nextInGroup[group] * POSITION_STEP };
  });

  await repository.reorderStatuses(positioned);

  return listStatuses(projectId);
};

/** `DELETE /:statusId`. Its tasks move to the default, in the same transaction as the delete. */
const deleteStatus = async (projectId, statusId) => {
  const existing = await repository.findStatus(projectId, statusId);
  if (!existing) throw notFound();

  if (existing.isDefault) {
    throw unprocessable('Make another status the default before deleting this one');
  }

  const replacement = await repository.findDefault(projectId);
  await repository.deleteStatus(statusId, replacement.id);
};

/**
 * The status a task should be given: the one requested, which must belong to
 * the task's project, or the project default when none was sent. Called by the
 * task service — the status table belongs to this module.
 */
const resolveStatus = async (projectId, statusId) => {
  await ensureDefaults(projectId);

  if (!statusId) return repository.findDefault(projectId);

  const status = await repository.findStatus(projectId, statusId);
  if (!status) throw unprocessable('That status does not exist in this project');

  return status;
};

export default {
  ensureDefaults,
  listStatuses,
  createStatus,
  updateStatus,
  reorderStatuses,
  deleteStatus,
  resolveStatus,
};
