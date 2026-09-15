/**
 * Sprint business rules: the PLANNING → ACTIVE → COMPLETED lifecycle, one
 * active sprint per project, and what completing a sprint does to its work.
 * Throws `AppError`; never touches `req`/`res`/Prisma directly.
 *
 * **Authorization is not this file's job.** `loadProject` / `loadSprint` and
 * `requireProjectWrite` have already run. What remains is everything that needs
 * the sprint row: its state, its stored dates, the project's other sprints.
 *
 * THE LIFECYCLE IS ONE WAY. There is no reopen: a completed sprint is the
 * record of what a time-box delivered. Editing or deleting one would rewrite
 * that record, so both are `409` once a sprint is COMPLETED, and delete is
 * refused for an ACTIVE sprint too — the way out of a running sprint is to
 * complete it, which says what happened to its work.
 *
 * COMPLETING RETURNS UNFINISHED WORK TO THE BACKLOG (frontend
 * `.claude/rules/workflow.md`). Tasks in a Complete-group status stay attached
 * as the sprint's record; everything else gets `sprintId = null`, in the same
 * transaction, with one history entry per returned task.
 *
 * See docs/api/sprint.md
 */

import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import { AUTH_CODES } from '../../shared/constants/authCodes.js';
import { SPRINT_MAX_DAYS, SPRINT_STATES } from '../../shared/constants/sprint.js';
import activityService from '../task/task-activity.service.js';
import repository from './sprint.repository.js';
import dto from './sprint.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const conflict = (message) => new AppError(httpStatus.CONFLICT, message, AUTH_CODES.CONFLICT);

const unprocessable = (message) =>
  new AppError(httpStatus.UNPROCESSABLE_ENTITY, message, AUTH_CODES.VALIDATION_ERROR);

/** `YYYY-MM-DD` → a UTC-midnight Date, or null. */
const toDate = (value) => (value ? new Date(`${value}T00:00:00.000Z`) : value === null ? null : undefined);

/** Checks the pair a write would LEAVE on the row — the patch's value, else the stored one. */
const checkWindow = (startDate, endDate) => {
  if (!startDate || !endDate) return;

  const days = (endDate.getTime() - startDate.getTime()) / DAY_MS;
  if (days < 0) throw unprocessable('The end date must be on or after the start date');
  if (days > SPRINT_MAX_DAYS) throw unprocessable(`A sprint can run at most ${SPRINT_MAX_DAYS} days`);
};

/** Display order: the running sprint, then the queue by number, then history newest first. */
const RANK = { ACTIVE: 0, PLANNING: 1, COMPLETED: 2 };

const byDisplayOrder = (a, b) =>
  RANK[a.state] - RANK[b.state] ||
  (a.state === SPRINT_STATES.COMPLETED ? b.number - a.number : a.number - b.number);

/** Shapes rows with their roll-ups, in one roll-up query for the whole list. */
const withRollups = async (rows) => {
  const rollups = dto.toRollups(await repository.findRollupRows(rows.map((row) => row.id)));

  return rows.map((row) => dto.toSprint(row, rollups[row.id]));
};

/** `GET /projects/:projectId/sprints`. */
const listSprints = async (project, { state }) => {
  const rows = await repository.findSprintsForProject(project.id, state);

  return withRollups([...rows].sort(byDisplayOrder));
};

/** `GET /sprints/:sprintId`. */
const getSprint = async (sprint) => {
  const [shaped] = await withRollups([await repository.findSprintById(sprint.id)]);

  return shaped;
};

/** `POST /projects/:projectId/sprints`. Always PLANNING; dates optional until start. */
const createSprint = async (project, payload, user) => {
  const startDate = toDate(payload.startDate);
  const endDate = toDate(payload.endDate);
  checkWindow(startDate, endDate);

  const row = await repository.createSprint(
    project.id,
    (number) => payload.name || `${project.key} Sprint ${number}`,
    {
      goal: payload.goal || null,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      capacityPoints: payload.capacityPoints ?? null,
      createdById: user.id,
    }
  );

  return dto.toSprint(row);
};

const detailsPatch = (sprint, payload) => {
  const startDate = toDate(payload.startDate);
  const endDate = toDate(payload.endDate);
  checkWindow(
    startDate === undefined ? sprint.startDate : startDate,
    endDate === undefined ? sprint.endDate : endDate
  );

  return {
    ...('name' in payload ? { name: payload.name } : {}),
    ...('goal' in payload ? { goal: payload.goal || null } : {}),
    ...(startDate !== undefined ? { startDate } : {}),
    ...(endDate !== undefined ? { endDate } : {}),
    ...('capacityPoints' in payload ? { capacityPoints: payload.capacityPoints } : {}),
  };
};

/** `PATCH /sprints/:sprintId`. Details only — state moves through start and complete. */
const updateSprint = async (sprint, payload) => {
  if (sprint.state === SPRINT_STATES.COMPLETED) throw conflict('A completed sprint cannot be edited');

  await repository.updateSprint(sprint.id, detailsPatch(sprint, payload));

  return getSprint(sprint);
};

/**
 * `POST /sprints/:sprintId/start`. PLANNING only, one ACTIVE per project, and
 * both dates set — from the body or already on the row.
 *
 * The one-active check runs here for a readable `409`; the partial unique index
 * `sprints_one_active_per_project` is what holds when two starts race, and its
 * P2002 reaches the client as the same `409` through the global handler.
 */
const startSprint = async (sprint, project, payload) => {
  if (sprint.state !== SPRINT_STATES.PLANNING) throw conflict('Only a sprint in planning can be started');

  const active = await repository.findActiveSprint(project.id);
  if (active) throw conflict(`${active.name} is still active. Complete it before starting another sprint.`);

  const patch = detailsPatch(sprint, payload);
  const startDate = patch.startDate ?? sprint.startDate;
  const endDate = patch.endDate ?? sprint.endDate;
  if (!startDate || !endDate) throw unprocessable('Set a start and end date to start the sprint');

  await repository.updateSprint(sprint.id, {
    ...patch,
    state: SPRINT_STATES.ACTIVE,
    startedAt: new Date(),
  });

  return getSprint(sprint);
};

/** `POST /sprints/:sprintId/complete`. Returns `{ sprint, completed, returned }`. */
const completeSprint = async (sprint, user) => {
  if (sprint.state !== SPRINT_STATES.ACTIVE) throw conflict('Only the active sprint can be completed');

  const [returnIds, liveIds] = await Promise.all([
    repository.findUnfinishedTaskIds(sprint.id),
    repository.findLiveTaskIds(sprint.id),
  ]);

  await repository.completeSprint(sprint.id, returnIds);
  await activityService.recordFieldChange(returnIds, 'sprint', { id: sprint.id, name: sprint.name }, null, user.id);

  return {
    sprint: await getSprint(sprint),
    completed: liveIds.length - returnIds.length,
    returned: returnIds.length,
  };
};

/** `DELETE /sprints/:sprintId`. PLANNING only; its tasks return to the backlog. */
const deleteSprint = async (sprint, user) => {
  if (sprint.state !== SPRINT_STATES.PLANNING) {
    throw conflict('Only a sprint in planning can be deleted. Complete an active sprint instead.');
  }

  const taskIds = await repository.findLiveTaskIds(sprint.id);

  await repository.deleteSprint(sprint.id);
  await activityService.recordFieldChange(taskIds, 'sprint', { id: sprint.id, name: sprint.name }, null, user.id);

  return { returned: taskIds.length };
};

export default {
  listSprints,
  getSprint,
  createSprint,
  updateSprint,
  startSprint,
  completeSprint,
  deleteSprint,
};
