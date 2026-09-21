/**
 * HTTP edge of the role module: read `req`, call the service, respond via
 * `ApiResponse`. No business logic, no Prisma, no `try/catch` — `asyncHandler`
 * at the routes layer forwards a rejection to the error middleware.
 *
 * `req.membership` is the CALLER's membership, already resolved by
 * `loadMembership` with its own custom role included. It is handed to the
 * service as the AUTHOR because the central rule of this module — a role may
 * not grant what its author does not hold — is answered from it, and the
 * service must not have to look the caller up again.
 *
 * See .claude/skills/api-response/SKILL.md and docs/api/role.md
 */

import ApiResponse from '../../shared/utils/apiResponse.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import service from './role.service.js';
import { PERMISSION_CATALOG } from '../../shared/constants/roles.js';

/**
 * The catalog every role is defined against. Static, but served per workspace
 * rather than from a constant file the browser imports: the set the server
 * gates on is the only one worth drawing, and shipping a second copy to the
 * client is how the two drift.
 */
const catalog = async (req, res) =>
  ApiResponse.success(res, httpStatus.OK, 'Permissions fetched', {
    groups: PERMISSION_CATALOG,
  });

const list = async (req, res) => {
  const roles = await service.listRoles(req.params.workspaceId);

  return ApiResponse.success(res, httpStatus.OK, 'Roles fetched', { roles });
};

const create = async (req, res) => {
  const role = await service.createRole(req.params.workspaceId, req.body, req.membership);

  return ApiResponse.success(res, httpStatus.CREATED, 'Role created', { role });
};

const update = async (req, res) => {
  const role = await service.updateRole(
    req.params.workspaceId,
    req.params.roleId,
    req.body,
    req.membership
  );

  return ApiResponse.success(res, httpStatus.OK, 'Role updated', { role });
};

/* 200 with a body, not 204: the client replaces its list from the response of
   every other write on this module, and one endpoint answering differently is
   a branch every caller has to remember. */
const remove = async (req, res) => {
  await service.deleteRole(req.params.workspaceId, req.params.roleId);

  return ApiResponse.success(res, httpStatus.OK, 'Role deleted', { id: req.params.roleId });
};

export default { catalog, list, create, update, remove };
