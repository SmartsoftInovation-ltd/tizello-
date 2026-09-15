/**
 * HTTP edge of the sprint module: read `req`, call the service, respond via
 * `ApiResponse`. No business logic, no Prisma, no `try/catch`.
 *
 * `req.project` and `req.sprint` are passed straight through: `loadProject` /
 * `loadSprint` already loaded the rows authorisation was decided on.
 *
 * See .claude/skills/api-response/SKILL.md and docs/api/sprint.md
 */

import ApiResponse from '../../shared/utils/apiResponse.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import service from './sprint.service.js';

const list = async (req, res) => {
  const sprints = await service.listSprints(req.project, req.query);

  return ApiResponse.success(res, httpStatus.OK, 'Sprints fetched', { sprints });
};

const create = async (req, res) => {
  const sprint = await service.createSprint(req.project, req.body, req.user);

  return ApiResponse.success(res, httpStatus.CREATED, 'Sprint created', { sprint });
};

const getById = async (req, res) => {
  const sprint = await service.getSprint(req.sprint);

  return ApiResponse.success(res, httpStatus.OK, 'Sprint fetched', { sprint });
};

const update = async (req, res) => {
  const sprint = await service.updateSprint(req.sprint, req.body);

  return ApiResponse.success(res, httpStatus.OK, 'Sprint updated', { sprint });
};

const start = async (req, res) => {
  const sprint = await service.startSprint(req.sprint, req.project, req.body);

  return ApiResponse.success(res, httpStatus.OK, 'Sprint started', { sprint });
};

const complete = async (req, res) => {
  const result = await service.completeSprint(req.sprint, req.user);

  return ApiResponse.success(res, httpStatus.OK, 'Sprint completed', result);
};

const remove = async (req, res) => {
  const result = await service.deleteSprint(req.sprint, req.user);

  return ApiResponse.success(res, httpStatus.OK, 'Sprint deleted', result);
};

export default { list, create, getById, update, start, complete, remove };
