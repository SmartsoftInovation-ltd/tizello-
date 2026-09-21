/**
 * Row → response shaping for workspace roles. A whitelist, like
 * `member.dto.js` and `workspace.dto.js` — never a `delete row.field`
 * blacklist, so a column added to `WorkspaceRole` later cannot leak by default.
 *
 * `permissions` is filtered against the catalog on the way OUT as well as on
 * the way in. A row written before a permission was retired still holds the
 * dead id, and shipping it would draw a matrix column the server no longer
 * gates on — a switch that claims to do something and does not is worse than
 * an absent one.
 *
 * See docs/api/role.md and .claude/plan/permissions.md
 */

import { ALL_PERMISSIONS } from '../../shared/constants/roles.js';

const toRole = (row) => ({
  id: row.id,
  name: row.name,
  baseRole: row.baseRole,
  builtIn: row.builtIn,
  permissions: ALL_PERMISSIONS.filter((id) => row.permissions?.includes(id)),
  // Present only when the caller asked for counts — `_count` is Prisma's own
  // shape and never reaches the client under that name.
  ...(row._count ? { memberCount: row._count.memberships } : {}),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export { toRole };
export default { toRole };
