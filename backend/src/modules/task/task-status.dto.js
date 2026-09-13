/**
 * Row → response shaping for task statuses. A whitelist, like every DTO here.
 *
 * `taskCount` comes from the repository's `_count` select and counts LIVE tasks
 * only — it is what the status editor shows before somebody deletes a status,
 * and soft-deleted tasks are not work anyone will miss.
 *
 * `toStatusRef` is the four-field shape embedded in every task response: enough
 * to draw the chip and to know the group, and nothing a task list needs to
 * re-fetch.
 *
 * See docs/api/task.md §Statuses
 */

const toStatus = (row) => ({
  id: row.id,
  projectId: row.projectId,
  name: row.name,
  color: row.color,
  group: row.group,
  position: row.position,
  isDefault: row.isDefault,
  taskCount: row._count?.tasks ?? 0,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toStatusRef = (row) =>
  row ? { id: row.id, name: row.name, color: row.color, group: row.group } : null;

export { toStatus, toStatusRef };
export default { toStatus, toStatusRef };
