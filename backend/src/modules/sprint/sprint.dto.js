/**
 * Row → response shaping for sprints. A whitelist, like every DTO here.
 *
 * The roll-ups (`taskCount`, `doneCount`, `totalPoints`, `donePoints`) are
 * derived from the sprint's live top-level tasks, never stored: a stored count
 * is a copy that every task write would have to remember to update, and one
 * that forgot would make a burndown lie. `key` is `SPR-${number}`, derived for
 * the same reason `task.key` is.
 *
 * Dates are emitted as `YYYY-MM-DD`: a sprint runs over calendar DAYS, and a
 * timestamp would make "ends on the 30th" shift a day for anyone west of UTC.
 *
 * See docs/api/sprint.md
 */

const day = (date) => (date ? new Date(date).toISOString().slice(0, 10) : null);

const person = (user) => (user ? { id: user.id, name: user.name, email: user.email } : null);

const EMPTY_ROLLUP = { taskCount: 0, doneCount: 0, totalPoints: 0, donePoints: 0 };

/** Folds rollup rows into `{ [sprintId]: rollup }`. Unestimated tasks add no points. */
const toRollups = (rows) =>
  rows.reduce((byId, row) => {
    const current = byId[row.sprintId] ?? { ...EMPTY_ROLLUP };
    const points = row.storyPoints ?? 0;
    const done = row.status?.group === 'COMPLETE';

    byId[row.sprintId] = {
      taskCount: current.taskCount + 1,
      doneCount: current.doneCount + (done ? 1 : 0),
      totalPoints: current.totalPoints + points,
      donePoints: current.donePoints + (done ? points : 0),
    };
    return byId;
  }, {});

const toSprint = (row, rollup = EMPTY_ROLLUP) => ({
  id: row.id,
  projectId: row.projectId,
  number: row.number,
  key: `SPR-${row.number}`,
  name: row.name,
  goal: row.goal,
  startDate: day(row.startDate),
  endDate: day(row.endDate),
  capacityPoints: row.capacityPoints,
  state: row.state,
  startedAt: row.startedAt,
  completedAt: row.completedAt,
  createdById: row.createdById,
  createdBy: person(row.createdBy),
  ...rollup,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export { toSprint, toRollups };
export default { toSprint, toRollups };
