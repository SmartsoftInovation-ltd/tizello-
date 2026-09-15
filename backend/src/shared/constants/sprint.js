/**
 * Sprint states and the limits the sprint module validates against.
 *
 * `SPRINT_STATES` must stay in sync with the `SprintState` enum in
 * prisma/schema.prisma — it is written to and read back from Postgres.
 *
 * See docs/api/sprint.md
 */

const SPRINT_STATES = {
  PLANNING: 'PLANNING',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
};

/** Past this a "sprint" is a quarter, and planning against it stops meaning anything. */
const SPRINT_MAX_DAYS = 90;

export { SPRINT_STATES, SPRINT_MAX_DAYS };
export default SPRINT_STATES;
