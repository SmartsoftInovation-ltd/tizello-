/**
 * HTTP edge of the workspace module: read `req`, call the service, respond
 * via `ApiResponse`. No business logic, no Prisma, no `try/catch` —
 * `asyncHandler` at the routes layer forwards a rejection to the error
 * middleware.
 *
 * See .claude/skills/api-response/SKILL.md and docs/api/workspace.md
 */

import ApiResponse from '../../shared/utils/apiResponse.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import service from './workspace.service.js';

const create = async (req, res) => {
  const workspace = await service.createWorkspace(req.body, req.user);

  return ApiResponse.success(res, httpStatus.CREATED, 'Workspace created', { workspace });
};

const list = async (req, res) => {
  const { workspaces, page, limit, total } = await service.listMyWorkspaces(
    req.user.id,
    req.query
  );

  return ApiResponse.paginated(res, httpStatus.OK, 'Workspaces fetched', workspaces, page, limit, total);
};

const overview = async (req, res) => {
  const data = await service.getOverview(req.user.id);

  return ApiResponse.success(res, httpStatus.OK, 'Workspace overview fetched', data);
};

const getById = async (req, res) => {
  const workspace = await service.getWorkspace(req.params.workspaceId, req.membership);

  return ApiResponse.success(res, httpStatus.OK, 'Workspace fetched', { workspace });
};

const update = async (req, res) => {
  const workspace = await service.updateWorkspace(req.params.workspaceId, req.body, req.membership);

  return ApiResponse.success(res, httpStatus.OK, 'Workspace updated', { workspace });
};

const archive = async (req, res) => {
  const workspace = await service.setArchived(
    req.params.workspaceId,
    req.body.isArchived,
    req.membership
  );

  return ApiResponse.success(res, httpStatus.OK, 'Workspace updated', { workspace });
};

const remove = async (req, res) => {
  await service.deleteWorkspace(req.params.workspaceId, req.membership);

  return ApiResponse.success(res, httpStatus.OK, 'Workspace deleted', null);
};

export default { create, list, overview, getById, update, archive, remove };
