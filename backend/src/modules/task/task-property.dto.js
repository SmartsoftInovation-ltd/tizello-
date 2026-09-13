/**
 * Row → response shaping for task property definitions. A whitelist, like
 * every DTO here.
 *
 * `projectId` where the project-property DTO has `workspaceId` — that is the
 * whole difference, and it is the point: a task column belongs to one project's
 * task database. `options` is normalised the same way, `[]` for the two select
 * types and `null` for the rest, so a client branches on the type alone.
 *
 * See docs/api/task.md
 */

import { OPTION_TYPES } from '../../shared/constants/propertyTypes.js';

const toTaskProperty = (row) => ({
  id: row.id,
  projectId: row.projectId,
  name: row.name,
  type: row.type,
  options: OPTION_TYPES.includes(row.type) ? (row.options ?? []) : null,
  position: row.position,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export { toTaskProperty };
export default { toTaskProperty };
