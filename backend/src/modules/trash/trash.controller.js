/**
 * HTTP edge of the trash module: read `req`, call the service, respond via
 * `ApiResponse`. No business logic, no Prisma, no `try/catch`.
 *
 * `req.user` is the whole scope — there is no `:workspaceId` and no
 * `:projectId` in any of these paths, because the trash is not a place inside
 * a project, it is everything of yours that is gone. The service resolves both
 * visibility and authority from `req.user.id`.
 *
 * See .claude/skills/api-response/SKILL.md and docs/api/trash.md
 */

import ApiResponse from '../../shared/utils/apiResponse.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import service from './trash.service.js';

const list = async (req, res) => {
  const trash = await service.listTrash(req.user, req.query);

  return ApiResponse.success(res, httpStatus.OK, 'Trash fetched', trash);
};

const restoreProject = async (req, res) => {
  const result = await service.restoreProject(req.params.id, req.user);

  return ApiResponse.success(res, httpStatus.OK, 'Project restored', result);
};

const restoreTask = async (req, res) => {
  const result = await service.restoreTask(req.params.id, req.user);

  return ApiResponse.success(res, httpStatus.OK, 'Task restored', result);
};

const purgeProject = async (req, res) => {
  const result = await service.purgeProject(req.params.id, req.user);

  return ApiResponse.success(res, httpStatus.OK, 'Project deleted forever', result);
};

const purgeTask = async (req, res) => {
  const result = await service.purgeTask(req.params.id, req.user);

  return ApiResponse.success(res, httpStatus.OK, 'Task deleted forever', result);
};

export default { list, restoreProject, restoreTask, purgeProject, purgeTask };
