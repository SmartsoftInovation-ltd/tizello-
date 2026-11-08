/**
 * Workspace business rules. Throws `AppError` on failure; never touches
 * `req`/`res`/Prisma directly, so every function here is callable from a
 * controller or, later, another service.
 *
 * **Authorization is not this file's job.** `loadMembership` and
 * `requirePermission` (shared/middlewares/permission.js) already ran by the
 * time any function below executes — this file trusts the `membership` it is
 * handed and does not re-derive or re-check a role.
 *
 * See .claude/plan/workspace.md and docs/api/workspace.md
 */

import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import { AUTH_CODES } from '../../shared/constants/authCodes.js';
import { ROLES, permissionsFor } from '../../shared/constants/roles.js';
import { CACHE_NS, remember } from '../../shared/utils/cache.js';
import repository from './workspace.repository.js';
import dto from './workspace.dto.js';

/**
 * The one `404` a caller with no live membership collapses into — a
 * soft-deleted workspace, someone else's workspace, or an id that never
 * existed all answer identically. `loadMembership` catches the "not a
 * member" case before this ever runs; this catches the case it cannot see —
 * a `Membership` row survives soft-delete, so a workspace can be
 * `deletedAt`-set while the caller's membership still resolves.
 */
const notFound = () =>
  new AppError(httpStatus.NOT_FOUND, 'Workspace not found', AUTH_CODES.NOT_FOUND);

/** `POST /workspaces`. No permission check — there is no workspace yet to scope one to. */
const createWorkspace = async ({ name, description, icon, color }, user) => {
  const workspace = await repository.createWorkspaceWithOwner({
    name,
    description: description ?? null,
    icon: icon ?? null,
    color: color ?? null,
    ownerId: user.id,
  });

  return dto.toWorkspace(workspace, ROLES.OWNER, permissionsFor({ role: ROLES.OWNER }));
};

/** `GET /workspaces`. Scoped to the caller's own memberships by the join in the repository. */
const listMyWorkspaces = async (userId, { page, limit, includeArchived }) => {
  const { rows, total } = await repository.findWorkspacesForUser(userId, {
    page,
    limit,
    includeArchived,
  });

  const workspaces = rows.map((row) => {
    const membership = row.memberships[0] ?? null;
    return dto.toWorkspace(row, membership?.role ?? null, permissionsFor(membership));
  });

  return { workspaces, page, limit, total };
};

/** `GET /workspaces/:id`. `membership` is the row `loadMembership` already resolved. */
const getWorkspace = async (workspaceId, membership) => {
  const workspace = await repository.findWorkspaceForMember(workspaceId, membership.userId);

  if (!workspace) throw notFound();

  return dto.toWorkspace(workspace, membership.role, permissionsFor(membership));
};

/** `PATCH /workspaces/:id`. Validator already rejected an empty `patch`. */
const updateWorkspace = async (workspaceId, patch, membership) => {
  const workspace = await repository.findWorkspaceForMember(workspaceId, membership.userId);
  if (!workspace) throw notFound();

  const updated = await repository.updateWorkspace(workspaceId, patch);

  return dto.toWorkspace(updated, membership.role, permissionsFor(membership));
};

/** `PATCH /workspaces/:id/archive`. */
const setArchived = async (workspaceId, isArchived, membership) => {
  const workspace = await repository.findWorkspaceForMember(workspaceId, membership.userId);
  if (!workspace) throw notFound();

  const updated = await repository.setArchived(workspaceId, isArchived);

  return dto.toWorkspace(updated, membership.role, permissionsFor(membership));
};

/** `DELETE /workspaces/:id`. No return value — the controller sends `data: null`. */
const deleteWorkspace = async (workspaceId, membership) => {
  const workspace = await repository.findWorkspaceForMember(workspaceId, membership.userId);
  if (!workspace) throw notFound();

  await repository.softDeleteWorkspace(workspaceId);
};

/**
 * `GET /workspaces/overview`. Scoped to the caller's memberships by the joins
 * in the repository.
 *
 * CACHED FOR 60 SECONDS per user (`cache:overview:<userId>`). Four aggregate
 * queries across every workspace the caller is in, on the page they land on
 * after sign-in, against a remote database — the most expensive read in the
 * app. It is a dashboard of totals, so a minute of staleness is the trade:
 * versioned invalidation would need every task, sprint and project write to
 * know every member of the workspace it touched.
 */
const OVERVIEW_TTL_SECONDS = 60;

const getOverview = async (userId) => {
  const { value } = await remember(
    { namespace: CACHE_NS.OVERVIEW, scopeId: userId, ttl: OVERVIEW_TTL_SECONDS },
    async () => dto.toOverview(await repository.findOverviewForUser(userId))
  );
  return value;
};

export default {
  getOverview,
  createWorkspace,
  listMyWorkspaces,
  getWorkspace,
  updateWorkspace,
  setArchived,
  deleteWorkspace,
};
