/**
 * HTTP edge of the task-property module: read `req`, call the service,
 * respond via `ApiResponse`. No logic, no Prisma, no `try/catch`.
 *
 * The project id is read from `req.project.id` rather than `req.params`:
 * `loadProject` has already resolved and authorised that row, and the id on it
 * is the one the permission decision was made about.
 *
 * See .claude/skills/api-response/SKILL.md and docs/api/task.md
 */

import ApiResponse from '../../shared/utils/apiResponse.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import service from './task-property.service.js';

const list = async (req, res) => {
  const properties = await service.listProperties(req.project.id);

  return ApiResponse.success(res, httpStatus.OK, 'Properties fetched', { properties });
};

const create = async (req, res) => {
  const property = await service.createProperty(req.project.id, req.body);

  return ApiResponse.success(res, httpStatus.CREATED, 'Property created', { property });
};

const update = async (req, res) => {
  const property = await service.updateProperty(req.project.id, req.params.propertyId, req.body);

  return ApiResponse.success(res, httpStatus.OK, 'Property updated', { property });
};

const remove = async (req, res) => {
  await service.deleteProperty(req.project.id, req.params.propertyId);

  return ApiResponse.success(res, httpStatus.OK, 'Property deleted', null);
};

export default { list, create, update, remove };
