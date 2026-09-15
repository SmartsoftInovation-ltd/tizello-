/**
 * A task's history: writing entries when a task changes, and reading them back.
 *
 * Called by the task and comment services, never by a route — there is no way
 * to POST history. Each write compares two SNAPSHOTS of the task (before and
 * after, both loaded with the response includes) field by field, and records
 * one `updated` entry per field that differs. Comparing snapshots rather than
 * the PATCH body is what makes a no-op write ("set priority to what it already
 * was") produce no entry, and what lets a bulk update and a drag share this.
 *
 * **Recording is best-effort, and that is deliberate.** It runs after the task
 * write has committed. If the history insert fails, the change the user made
 * still happened — failing their request would report a save as failed when it
 * was not, and retrying it would apply the change twice. The failure is logged
 * at `error` so it is seen, not swallowed.
 *
 * See docs/api/task.md §Activity
 */

import { createLogger } from '../../config/logger.js';
import repository from './task-activity.repository.js';
import dto, { OPAQUE, SNAPSHOT } from './task-activity.dto.js';

const log = createLogger('task-activity');

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const write = async (entries) => {
  if (entries.length === 0) return;

  try {
    await repository.createEntries(entries);
  } catch (error) {
    log.error({ err: error, taskIds: [...new Set(entries.map((entry) => entry.taskId))] }, 'Task activity not recorded');
  }
};

/** The entries one before/after pair produces. Pure — exported for bulk writes. */
const changesBetween = (before, after, actorId) =>
  Object.entries(SNAPSHOT).flatMap(([field, read]) => {
    const from = read(before);
    const to = read(after);
    if (same(from, to)) return [];

    return [
      {
        taskId: after.id,
        actorId,
        action: 'updated',
        field,
        from: OPAQUE.has(field) ? null : from,
        to: OPAQUE.has(field) ? null : to,
      },
    ];
  });

const recordCreated = (taskId, actorId) => write([{ taskId, actorId, action: 'created' }]);

const recordChanges = (before, after, actorId) => write(changesBetween(before, after, actorId));

/** Many pairs, one insert — a bulk update of 50 tasks is one history write, not 50. */
const recordManyChanges = (pairs, actorId) =>
  write(pairs.flatMap(([before, after]) => changesBetween(before, after, actorId)));

/**
 * The same change on many tasks, already known — for writes that do not go
 * through a task update, like completing or deleting a sprint.
 */
const recordFieldChange = (taskIds, field, from, to, actorId) =>
  write(taskIds.map((taskId) => ({ taskId, actorId, action: 'updated', field, from, to })));

const recordComment = (taskId, actorId) => write([{ taskId, actorId, action: 'commented' }]);

const listActivity = async (taskId) => {
  const rows = await repository.findActivityForTask(taskId);

  return rows.map(dto.toActivity);
};

export default {
  recordCreated,
  recordChanges,
  recordManyChanges,
  recordFieldChange,
  recordComment,
  listActivity,
};
