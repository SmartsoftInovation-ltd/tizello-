/**
 * HTTP edge of the project module: read `req`, call the service, respond via
 * `ApiResponse`. No business logic, no Prisma, no `try/catch` — `asyncHandler`
 * at the routes layer forwards a rejection to the error middleware.
 *
 * `getById` passes `req.project` and `req.projectRole` straight through rather
 * than re-fetching by id: `loadProject` already loaded the row to decide
 * whether this request was allowed at all, and a second read of the same row
 * can only disagree with the one authorization was based on.
 *
 * See .claude/skills/api-response/SKILL.md and docs/api/project.md
 */

import ApiResponse from '../../shared/utils/apiResponse.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import service from './project.service.js';

const create = async (req, res) => {
  const project = await service.createProject(req.body, req.params.workspaceId, req.user);

  return ApiResponse.success(res, httpStatus.CREATED, 'Project created', { project });
};

const list = async (req, res) => {
  const { projects, page, limit, total, fromCached } = await service.listProjects(
    req.params.workspaceId,
    req.user.id,
    req.query
  );

  return ApiResponse.paginated(
    res,
    httpStatus.OK,
    'Projects fetched',
    projects,
    page,
    limit,
    total,
    { fromCached }
  );
};

const getById = async (req, res) => {
  const project = await service.getProject(req.project, req.projectRole);

  return ApiResponse.success(res, httpStatus.OK, 'Project fetched', { project });
};

const update = async (req, res) => {
  const project = await service.updateProject(req.project, req.body, req.projectRole);

  return ApiResponse.success(res, httpStatus.OK, 'Project updated', { project });
};

const archive = async (req, res) => {
  const project = await service.setArchived(req.project, req.body.isArchived, req.projectRole);

  return ApiResponse.success(res, httpStatus.OK, 'Project updated', { project });
};

const remove = async (req, res) => {
  await service.deleteProject(req.project);

  return ApiResponse.success(res, httpStatus.OK, 'Project deleted', null);
};

const listMembers = async (req, res) => {
  const { members, page, limit, total } = await service.listMembers(req.project.id, req.query);

  return ApiResponse.paginated(res, httpStatus.OK, 'Members fetched', members, page, limit, total);
};

const addMember = async (req, res) => {
  const member = await service.addMember(req.project, req.body);

  return ApiResponse.success(res, httpStatus.CREATED, 'Member added', { member });
};

const updateMemberRole = async (req, res) => {
  const member = await service.updateMemberRole(req.project, req.params.userId, req.body.role);

  return ApiResponse.success(res, httpStatus.OK, 'Member updated', { member });
};

const removeMember = async (req, res) => {
  await service.removeMember(req.project, req.params.userId);

  return ApiResponse.success(res, httpStatus.OK, 'Member removed', null);
};

const transferOwnership = async (req, res) => {
  const project = await service.transferOwnership(req.project, req.body.userId, req.projectRole);

  return ApiResponse.success(res, httpStatus.OK, 'Ownership transferred', { project });
};

export default {
  create,
  list,
  getById,
  update,
  archive,
  remove,
  listMembers,
  addMember,
  updateMemberRole,
  removeMember,
  transferOwnership,
};
