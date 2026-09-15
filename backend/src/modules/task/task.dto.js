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
    assigneeId: row.assigneeId,
    assignee: toPerson(row.assignee),
    dueDate: row.dueDate,
    completedAt: row.completedAt,
    tags: row.tags ?? [],
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
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

export { toTask, toPerson };
export default { toTask, toPerson };
