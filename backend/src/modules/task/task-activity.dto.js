/**
 * Row → response shaping for task activity, plus the SNAPSHOT a task row is
 * reduced to before two versions of it are compared.
 *
 * The snapshot is display-shaped on purpose — `{ id, name }` for a status or a
 * person, `{ id, key, title }` for a parent — because an entry must still read
 * correctly after the status is renamed or the person leaves. It is computed
 * from a row loaded with `TASK_INCLUDE` (task.repository.js), so every name is
 * already on it.
 *
 * `description` and `properties` are compared in full but never STORED (see
 * `OPAQUE`): history says "changed the description", and copying 5000
 * characters into every entry would make the table the largest in the database.
 *
 * See docs/api/task.md §Activity
 */

import { toPerson } from './task.dto.js';

const personName = (user) => (user ? { id: user.id, name: user.name ?? user.email } : null);

const day = (date) => (date ? new Date(date).toISOString().slice(0, 10) : null);

/** Field name → how a task row reads for that field. Keys are what `field` stores. */
const SNAPSHOT = {
  title: (row) => row.title,
  description: (row) => row.description ?? null,
  type: (row) => row.type,
  status: (row) => (row.status ? { id: row.status.id, name: row.status.name, color: row.status.color } : null),
  priority: (row) => row.priority,
  // A list since tasks took several assignees. Entries written before that
  // carry `field: "assignee"` with a single person, and still read back as-is.
  assignees: (row) => (row.assignees ?? []).map((assignment) => personName(assignment.user)),
  dueDate: (row) => day(row.dueDate),
  storyPoints: (row) => row.storyPoints,
  sprint: (row) => (row.sprint ? { id: row.sprint.id, name: row.sprint.name } : null),
  tags: (row) => row.tags ?? [],
  parent: (row) =>
    row.parent && !row.parent.deletedAt
      ? { id: row.parent.id, key: `${row.project?.key ?? ''}-${row.parent.number}`, title: row.parent.title }
      : null,
  attachments: (row) => (Array.isArray(row.attachments) ? row.attachments.length : 0),
  properties: (row) => JSON.stringify(row.properties ?? {}),
};

/** Fields whose value is not worth showing — the entry only says it changed. */
const OPAQUE = new Set(['description', 'properties']);

const toActivity = (row) => ({
  id: row.id,
  taskId: row.taskId,
  actorId: row.actorId,
  actor: toPerson(row.actor),
  action: row.action,
  field: row.field,
  from: row.from,
  to: row.to,
  createdAt: row.createdAt,
});

export { SNAPSHOT, OPAQUE, toActivity };
export default { SNAPSHOT, OPAQUE, toActivity };
