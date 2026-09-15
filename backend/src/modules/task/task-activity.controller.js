/**
 * HTTP edge of the task-activity module: read `req`, call the service, respond
 * via `ApiResponse`. No logic, no Prisma, no `try/catch`.
 *
 * See .claude/skills/api-response/SKILL.md and docs/api/task.md §Activity
 */

import ApiResponse from '../../shared/utils/apiResponse.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import service from './task-activity.service.js';

const list = async (req, res) => {
  const activity = await service.listActivity(req.task.id);

  return ApiResponse.success(res, httpStatus.OK, 'Activity fetched', { activity });
};

export default { list };
