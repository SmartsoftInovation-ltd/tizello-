/**
 * Row → response shaping for workspace memberships. A whitelist, like
 * `workspace.dto.js` and `auth.dto.js` — never a `delete row.field` blacklist,
 * so a column added to `Membership` later cannot leak by default.
 *
 * Moved here unchanged from `workspace.dto.js#toWorkspaceMember`: the roster's
 * writes live in this module, and a response shape whose read is in one module
 * and whose writes are in another has two owners and therefore none. The shape
 * is byte-identical to what shipped, because the frontend already parses it
 * (`frontend/src/lib/workspaces.ts#getWorkspaceMembers`).
 *
 * `id` is the MEMBERSHIP, `userId` is the person — and `userId` is what every
 * other endpoint takes (adding a project member, transferring ownership), so a
 * client that confuses the two gets a 404 rather than silent nonsense. This
 * module's `:memberId` is the former.
 *
 * See docs/api/member.md and .claude/plan/member.md §2.2
 */

const toMember = (row) => ({
  id: row.id,
  userId: row.userId,
  // The TIER, always present. It is what `roleAtLeast` walks and what every
  // client that predates custom roles reads, so it keeps its name and meaning.
  role: row.role,
  // The workspace-defined role, when they hold one. `null` — not absent — so a
  // client can tell "falls back to the tier" from "this field was not selected".
  roleId: row.roleId ?? null,
  roleName: row.customRole?.name ?? null,
  createdAt: row.createdAt,
  ...(row.user
    ? { user: { id: row.user.id, name: row.user.name, email: row.user.email } }
    : {}),
});

/**
 * One owned project, as the `409` on removal names it.
 *
 * Three fields, not the project DTO: this is a list of things the admin has to
 * deal with before the removal can proceed, and `key` is what the UI shows
 * beside a project name. Reusing `project.dto.js` here would couple the member
 * module's error body to a shape the project module is free to change.
 */
const toOwnedProject = (row) => ({ id: row.id, name: row.name, key: row.key });

export { toMember, toOwnedProject };
export default { toMember, toOwnedProject };
