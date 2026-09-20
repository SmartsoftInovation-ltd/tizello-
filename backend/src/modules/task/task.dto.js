/**
 * Row → response shaping for tasks. A whitelist, like every DTO here, so a
 * column added to the model later cannot leak by default — `deletedAt` is the
 * one that exists today and is deliberately never emitted.
 *
 * Three fields are derived rather than read:
 *
 * - `key` is `${project.key}-${number}`. Stored nowhere, because the project
 *   key is immutable and the number never changes — a column would be a copy
 *   that could only ever agree or be wrong.
 * - `parent` is `null` when the parent is soft-deleted. Deleting a task nulls
 *   its live children's `parentId` in the same transaction, so this is belt and
 *   braces for a row written before that rule, not a normal path.
 * - `properties` keeps only keys whose TaskPropertyDef still exists, the same
 *   O(1)-delete bargain `project.dto.js` makes (plan project-property §2.4).
 *
 * `subtaskCount` / `commentCount` come from the repository's `_count` select.
 *
 * See docs/api/task.md
 */

import { toStatusRef } from './task-status.dto.js';

const liveProperties = (stored, definitions) => {
  if (!stored || !definitions) return {};

  const live = new Set(definitions.map((definition) => definition.id));

  return Object.fromEntries(Object.entries(stored).filter(([id]) => live.has(id)));
};

const toPerson = (user) => (user ? { id: user.id, name: user.name, email: user.email } : null);

const toTask = (row, definitions = null) => {
  const projectKey = row.project?.key ?? '';

  return {
    id: row.id,
    projectId: row.projectId,
    number: row.number,
    key: `${projectKey}-${row.number}`,
    title: row.title,
    description: row.description,
    type: row.type,
    storyPoints: row.storyPoints,
    position: row.position,
    icon: row.icon,
    color: row.color,
    statusId: row.statusId,
    status: toStatusRef(row.status),
    priority: row.priority,
    assignees: (row.assignees ?? []).map((assignment) => toPerson(assignment.user)),
    dueDate: row.dueDate,
    completedAt: row.completedAt,
    tags: row.tags ?? [],
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    sprintId: row.sprintId,
    sprint: row.sprint ? { id: row.sprint.id, name: row.sprint.name, state: row.sprint.state } : null,
    parentId: row.parentId,
    parent:
      row.parent && !row.parent.deletedAt
        ? {
            id: row.parent.id,
            number: row.parent.number,
            key: `${projectKey}-${row.parent.number}`,
            title: row.parent.title,
          }
        : null,
    subtaskCount: row._count?.subtasks ?? 0,
    commentCount: row._count?.comments ?? 0,
    properties: liveProperties(row.properties, definitions),
    createdById: row.createdById,
    createdBy: toPerson(row.createdBy),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

/**
 * A task on the cross-project "My tasks" list.
 *
 * `toTask` plus the project it belongs to. Everywhere else a task is read
 * INSIDE a project, so the project is context the caller already has and
 * repeating it on every row would be noise; here the list spans projects and
 * workspaces, so "which project is this?" is the column that makes the row
 * make sense — and `workspaceId` is what lets it be a link rather than a label.
 *
 * `properties` comes back EMPTY, and that is deliberate rather than an
 * oversight: custom properties are defined per project, so filling them for a
 * list spanning N projects would mean N definition fetches to render columns
 * this list does not draw. `toTask` already returns `{}` when no definitions
 * are passed — see `liveProperties`.
 */
const toAssignedTask = (row) => ({
  ...toTask(row),
  project: {
    id: row.project.id,
    key: row.project.key,
    name: row.project.name,
    workspaceId: row.project.workspaceId,
  },
});

export { toTask, toAssignedTask, toPerson };
export default { toTask, toAssignedTask, toPerson };
