/**
 * HTTP edge of the task-comment module: read `req`, call the service, respond
 * via `ApiResponse`. No logic, no Prisma, no `try/catch`.
 *
 * See .claude/skills/api-response/SKILL.md and docs/api/task.md
 */

import ApiResponse from '../../shared/utils/apiResponse.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import service from './task-comment.service.js';

const list = async (req, res) => {
  const comments = await service.listComments(req.task.id);

  return ApiResponse.success(res, httpStatus.OK, 'Comments fetched', { comments });
};

const create = async (req, res) => {
  const comment = await service.createComment(req.task.id, req.user, req.body.body);

  return ApiResponse.success(res, httpStatus.CREATED, 'Comment added', { comment });
};

const remove = async (req, res) => {
  await service.deleteComment(
    req.task.id,
    req.params.commentId,
    req.user.id,
    req.canWriteProject
  );

  return ApiResponse.success(res, httpStatus.OK, 'Comment deleted', null);
};

export default { list, create, remove };
