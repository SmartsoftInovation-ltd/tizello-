/**
 * Business rules for task comments.
 *
 * Authorization is the guards' job for everything but ONE decision: who may
 * delete a comment. That depends on the comment's author, which no middleware
 * has loaded, so the rule lives here — the author may always delete their own,
 * and anyone who may WRITE the project (the `canWriteProject` flag
 * `markProjectWriter` stamped on the request) may moderate anyone's.
 *
 * Editing is stricter than deleting: ONLY the author may edit. A moderator may
 * remove what someone said, but putting different words under their name is
 * not moderation.
 *
 * See docs/api/task.md
 */

import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import { AUTH_CODES } from '../../shared/constants/authCodes.js';
import repository from './task-comment.repository.js';
import activityService from './task-activity.service.js';
import dto from './task-comment.dto.js';

const listComments = async (taskId) => {
  const rows = await repository.findCommentsForTask(taskId);

  return rows.map(dto.toComment);
};

const createComment = async (taskId, user, body) => {
  const row = await repository.createComment(taskId, user.id, body);

  await activityService.recordComment(taskId, user.id);

  return dto.toComment(row);
};

const notFound = () => new AppError(httpStatus.NOT_FOUND, 'Comment not found', AUTH_CODES.NOT_FOUND);

const forbidden = () =>
  new AppError(
    httpStatus.FORBIDDEN,
    'You do not have permission to perform this action',
    AUTH_CODES.FORBIDDEN
  );

/** Author only — see the header. 404 before 403, as for delete. */
const updateComment = async (taskId, commentId, userId, body) => {
  const comment = await repository.findComment(taskId, commentId);

  if (!comment) throw notFound();
  if (comment.authorId !== userId) throw forbidden();

  const row = await repository.updateComment(comment.id, body);

  return dto.toComment(row);
};

/**
 * 404 before 403, deliberately: a comment id that is not on this task is not
 * found, and only a comment that exists here can be somebody else's.
 */
const deleteComment = async (taskId, commentId, userId, canWriteProject) => {
  const comment = await repository.findComment(taskId, commentId);

  if (!comment) throw notFound();
  if (comment.authorId !== userId && !canWriteProject) throw forbidden();

  await repository.deleteComment(comment.id);
};

export default { listComments, createComment, updateComment, deleteComment };
