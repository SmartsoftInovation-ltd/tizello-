/**
 * Workspace roles: the rules about which roles may be created, changed and
 * deleted, and what a role is allowed to grant.
 *
 * THE THREE BUILT-INS ARE SEEDED, NOT HARD-CODED HERE. A workspace created
 * before this feature has no role rows at all, so `listRoles` seeds them on
 * first read from `ROLE_PERMISSIONS` — the same table `permissionsFor` falls
 * back to. That keeps one definition of what Owner means instead of two that
 * can drift, and it means no migration has to backfill every existing
 * workspace before the screen works.
 *
 * WHAT A CUSTOM ROLE MAY NOT DO, and why each line is here:
 *   - It may not be named after a built-in, or sit on the OWNER rung. Both
 *     would make the role list lie about who holds ultimate authority.
 *   - It may not grant a permission its own base tier does not have. Without
 *     this, an ADMIN with `roles.manage` writes a role granting
 *     `workspace.delete`, assigns it to themselves, and has escalated past the
 *     owner — the classic self-grant hole. The ceiling is the AUTHOR'S grant,
 *     not the new role's base tier, so an admin cannot hand out more than they
 *     hold even to a role they place above themselves.
 *   - A built-in may not be edited or deleted at all. The application code is
 *     written against what OWNER means.
 *
 * See docs/api/role.md and .claude/skills/module-consistency/SKILL.md
 */

import repository from './role.repository.js';
import dto from './role.dto.js';
import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import { AUTH_CODES } from '../../shared/constants/authCodes.js';
import {
  ROLES,
  ROLE_PERMISSIONS,
  ALL_PERMISSIONS,
  permissionsFor,
} from '../../shared/constants/roles.js';

const BUILT_IN_LABEL = {
  [ROLES.OWNER]: 'Owner',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.MEMBER]: 'Member',
};

/* The rows `seedBuiltIns` writes: one per tier, granting exactly what
   ROLE_PERMISSIONS already says that tier grants. */
const BUILT_IN_ROWS = Object.values(ROLES).map((tier) => ({
  name: BUILT_IN_LABEL[tier],
  baseRole: tier,
  permissions: [...(ROLE_PERMISSIONS[tier] ?? [])],
}));

const notFound = () =>
  new AppError(httpStatus.NOT_FOUND, 'Role not found', AUTH_CODES.NOT_FOUND);

const forbidden = (message) =>
  new AppError(httpStatus.FORBIDDEN, message, AUTH_CODES.FORBIDDEN);

const conflict = (message, details) =>
  new AppError(httpStatus.CONFLICT, message, AUTH_CODES.CONFLICT, details);

/** A built-in is a record of what the code means, not a row to be edited. */
const assertEditable = (role) => {
  if (role.builtIn) {
    throw forbidden('Built-in roles cannot be changed');
  }
};

/**
 * The permissions a role may be given: the requested set, narrowed to what the
 * AUTHOR holds.
 *
 * Narrowed rather than rejected, with one exception — asking for something you
 * do not hold is a client that has drifted from the server's catalog, and
 * silently granting less than was asked for would leave a matrix on screen that
 * disagrees with the row. So a request that names a permission above the
 * author's own ceiling is refused outright, and the response says which.
 */
const resolveGrant = (requested, author) => {
  const ceiling = permissionsFor(author);
  const over = requested.filter((id) => !ceiling.includes(id));

  if (over.length > 0) {
    throw forbidden(
      'A role cannot grant a permission you do not hold yourself'
    );
  }

  return ALL_PERMISSIONS.filter((id) => requested.includes(id));
};

/**
 * Every role in the workspace, seeding the built-ins on first read.
 *
 * The seed is idempotent (`skipDuplicates`) and only fires when no built-in is
 * present, so the common path is one query.
 */
const listRoles = async (workspaceId) => {
  const existing = await repository.findByWorkspace(workspaceId);
  if (existing.some((role) => role.builtIn)) return existing.map(dto.toRole);

  await repository.seedBuiltIns(workspaceId, BUILT_IN_ROWS);
  const seeded = await repository.findByWorkspace(workspaceId);
  return seeded.map(dto.toRole);
};

const createRole = async (workspaceId, input, author) => {
  const name = input.name.trim();

  /* Checked before the write so the message can name the clash. The unique
     index is still the thing that settles a race — this is the readable path,
     not the correctness one. */
  if (await repository.findByName(workspaceId, name)) {
    throw conflict('A role with that name already exists');
  }

  const row = await repository.create({
    workspaceId,
    name,
    baseRole: input.baseRole ?? ROLES.MEMBER,
    permissions: resolveGrant(input.permissions, author),
    createdById: author.userId ?? null,
  });

  return dto.toRole(row);
};

const updateRole = async (workspaceId, roleId, input, author) => {
  const role = await repository.findById(roleId, workspaceId);
  if (!role) throw notFound();
  assertEditable(role);

  const name = input.name?.trim();
  if (name && name !== role.name && (await repository.findByName(workspaceId, name))) {
    throw conflict('A role with that name already exists');
  }

  const row = await repository.update(roleId, {
    ...(name ? { name } : {}),
    ...(input.baseRole ? { baseRole: input.baseRole } : {}),
    ...(input.permissions ? { permissions: resolveGrant(input.permissions, author) } : {}),
  });

  return dto.toRole(row);
};

/**
 * Deleting a role does not delete the people who hold it — `roleId` is
 * `SetNull`, so they fall back to their tier's default grant.
 *
 * That is a REAL change in what those members can do, so it is refused while
 * anyone still holds the role rather than applied silently. The error names the
 * count so the client can say "reassign 3 members first".
 */
const deleteRole = async (workspaceId, roleId) => {
  const role = await repository.findById(roleId, workspaceId);
  if (!role) throw notFound();
  assertEditable(role);

  const holders = await repository.countMembers(roleId);
  if (holders > 0) {
    throw conflict('Reassign the members holding this role first', { memberCount: holders });
  }

  await repository.remove(roleId);
};

/** The role a member may be assigned, or `null` to fall back to their tier. */
const findAssignable = async (workspaceId, roleId) => {
  const role = await repository.findById(roleId, workspaceId);
  if (!role) throw notFound();
  return role;
};

export default { listRoles, createRole, updateRole, deleteRole, findAssignable };
export { BUILT_IN_ROWS };
