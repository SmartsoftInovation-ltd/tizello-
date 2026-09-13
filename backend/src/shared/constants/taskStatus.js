/**
 * The fixed vocabulary behind a project's editable task statuses.
 *
 * The OPTIONS are data (`TaskStatusOption` rows, renamed and reordered by
 * users); the GROUPS and COLOURS are not. A group is what the rest of the
 * backend reasons about — `completedAt` follows entering and leaving COMPLETE —
 * so it has to be a closed set the code can name. A colour is a token the
 * frontend maps to its own palette, so accepting a hex here would let a client
 * paint a status in a colour no theme was designed for.
 *
 * `STATUS_GROUPS` must stay in sync with the `TaskStatusGroup` enum in
 * prisma/schema.prisma, and in the same order: the enum's declaration order is
 * the display order Postgres sorts by.
 *
 * See docs/api/task.md §Statuses
 */

const STATUS_GROUPS = ['TODO', 'IN_PROGRESS', 'COMPLETE'];

const STATUS_COLORS = [
  'gray',
  'brown',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'red',
];

/** Sparse positions within a group, so a reorder never renumbers a neighbour. */
const POSITION_STEP = 10;

/**
 * What every project starts with — the three statuses the old `TaskStatus`
 * enum had, so a project that never opens the status editor behaves exactly as
 * it did before statuses were editable. The migration seeds the same three for
 * projects that already existed.
 */
const DEFAULT_STATUSES = [
  { name: 'Not Started', color: 'gray', group: 'TODO', position: POSITION_STEP, isDefault: true },
  { name: 'In Progress', color: 'blue', group: 'IN_PROGRESS', position: POSITION_STEP, isDefault: false },
  { name: 'Done', color: 'green', group: 'COMPLETE', position: POSITION_STEP, isDefault: false },
];

export { STATUS_GROUPS, STATUS_COLORS, POSITION_STEP, DEFAULT_STATUSES };
