/**
 * HTTP edge of the member module: read `req`, call the service, respond via
 * `ApiResponse`. No business logic, no Prisma, no `try/catch` — `asyncHandler`
 * at the routes layer forwards a rejection to the error middleware.
 *
 * `req.membership` is the CALLER's membership, already resolved by
 * `loadMembership`. It is passed to the service as `actorMembership` because two
 * of the rules there are about identity — you cannot change or remove your own
 * membership — and the service must not have to go and look the caller up again.
 *
 * See .claude/skills/api-response/SKILL.md and docs/api/member.md
 */

import ApiResponse from '../../shared/utils/apiResponse.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import service from './member.service.js';

/**
 * The message string `'Members fetched'` and the `{ members }` wrapper are
 * load-bearing: this endpoint moved here from the workspace module and the
 * frontend already parses that exact shape
 * (`frontend/src/lib/workspaces.ts#getWorkspaceMembers`).
 */
const list = async (req, res) => {
  const members = await service.listMembers(req.params.workspaceId);

  return ApiResponse.success(res, httpStatus.OK, 'Members fetched', { members });
};

/**
 * Returns the full roster row, not just the new role, so the client can replace
 * one row in place instead of refetching the list.
 */
const updateRole = async (req, res) => {
  const member = await service.changeRole({
    workspaceId: req.params.workspaceId,
    memberId: req.params.memberId,
    role: req.body.role,
    roleId: req.body.roleId,
    actorMembership: req.membership,
  });

  return ApiResponse.success(res, httpStatus.OK, 'Member role updated', { member });
};

/**
 * `200` with a null `data`, not `204`. The house preference is an envelope; the
 * `204`s in the invitation module are a documented exception taken because a
 * revoked invitation still HAS a row the client must not be tempted to render.
 * There is no row left to misrender here.
 */
const remove = async (req, res) => {
  await service.removeMember({
    workspaceId: req.params.workspaceId,
    memberId: req.params.memberId,
    actorMembership: req.membership,
  });

  return ApiResponse.success(res, httpStatus.OK, 'Member removed', null);
};

export default { list, updateRole, remove };
