/**
 * HTTP edge of the task-status module: read `req`, call the service, respond
 * via `ApiResponse`. No logic, no Prisma, no `try/catch`.
 *
 * The project id is read from `req.project.id`, the row `loadProject` already
 * authorised, never from `req.params`.
 *
 * See .claude/skills/api-response/SKILL.md and docs/api/task.md §Statuses
 */

import ApiResponse from '../../shared/utils/apiResponse.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import service from './task-status.service.js';

const list = async (req, res) => {
  const statuses = await service.listStatuses(req.project.id);

  return ApiResponse.success(res, httpStatus.OK, 'Statuses fetched', { statuses });
};

const create = async (req, res) => {
  const status = await service.createStatus(req.project.id, req.body);

  return ApiResponse.success(res, httpStatus.CREATED, 'Status created', { status });
};

const update = async (req, res) => {
  const status = await service.updateStatus(req.project.id, req.params.statusId, req.body);

  return ApiResponse.success(res, httpStatus.OK, 'Status updated', { status });
};

const reorder = async (req, res) => {
  const statuses = await service.reorderStatuses(req.project.id, req.body.statuses);

  return ApiResponse.success(res, httpStatus.OK, 'Statuses reordered', { statuses });
};

const remove = async (req, res) => {
  await service.deleteStatus(req.project.id, req.params.statusId);

  return ApiResponse.success(res, httpStatus.OK, 'Status deleted', null);
};

export default { list, create, update, reorder, remove };
