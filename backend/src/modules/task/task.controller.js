/**
 * HTTP edge of the task module: read `req`, call the service, respond via
 * `ApiResponse`. No business logic, no Prisma, no `try/catch`.
 *
 * `req.project` and `req.task` are passed straight through rather than
 * re-fetched by id: `loadProject` / `loadTask` already loaded the rows that
 * authorisation was decided on, and a second read can only disagree with them.
 *
 * See .claude/skills/api-response/SKILL.md and docs/api/task.md
 */

import ApiResponse from '../../shared/utils/apiResponse.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import service from './task.service.js';

const list = async (req, res) => {
  const { tasks, page, limit, total } = await service.listTasks(req.project, req.query);

  return ApiResponse.paginated(res, httpStatus.OK, 'Tasks fetched', tasks, page, limit, total);
};

const create = async (req, res) => {
  const task = await service.createTask(req.project, req.body, req.user);

  return ApiResponse.success(res, httpStatus.CREATED, 'Task created', { task });
};

const getById = async (req, res) => {
  const task = await service.getTask(req.task);

  return ApiResponse.success(res, httpStatus.OK, 'Task fetched', { task });
};

const update = async (req, res) => {
  const task = await service.updateTask(req.task, req.project, req.body, req.user);

  return ApiResponse.success(res, httpStatus.OK, 'Task updated', { task });
};

const move = async (req, res) => {
  const task = await service.moveTask(req.task, req.project, req.body, req.user);

  return ApiResponse.success(res, httpStatus.OK, 'Task moved', { task });
};

const bulkUpdate = async (req, res) => {
  const tasks = await service.bulkUpdateTasks(req.project, req.body, req.user);

  return ApiResponse.success(res, httpStatus.OK, 'Tasks updated', { tasks });
};

const bulkRemove = async (req, res) => {
  const result = await service.bulkDeleteTasks(req.project, req.body);

  return ApiResponse.success(res, httpStatus.OK, 'Tasks deleted', result);
};

const remove = async (req, res) => {
  await service.deleteTask(req.task);

  return ApiResponse.success(res, httpStatus.OK, 'Task deleted', null);
};

export default { list, create, getById, update, move, bulkUpdate, bulkRemove, remove };
