/**
 * Business rules for task comments.
 *
 * Authorization is the guards' job for everything but ONE decision: who may
 * delete a comment. That depends on the comment's author, which no middleware
 * has loaded, so the rule lives here — the author may always delete their own,
 * and anyone who may WRITE the project (the `canWriteProject` flag
 * `markProjectWriter` stamped on the request) may moderate anyone's.
 *
 * See docs/api/task.md
 */

import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import { AUTH_CODES } from '../../shared/constants/authCodes.js';
import repository from './task-comment.repository.js';
import dto from './task-comment.dto.js';

const listComments = async (taskId) => {
  const rows = await repository.findCommentsForTask(taskId);

  return rows.map(dto.toComment);
};

const createComment = async (taskId, user, body) => {
  const row = await repository.createComment(taskId, user.id, body);

  return dto.toComment(row);
};

/**
 * 404 before 403, deliberately: a comment id that is not on this task is not
 * found, and only a comment that exists here can be somebody else's.
 */
const deleteComment = async (taskId, commentId, userId, canWriteProject) => {
  const comment = await repository.findComment(taskId, commentId);

  if (!comment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Comment not found', AUTH_CODES.NOT_FOUND);
  }

  if (comment.authorId !== userId && !canWriteProject) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You do not have permission to perform this action',
      AUTH_CODES.FORBIDDEN
    );
  }

  await repository.deleteComment(comment.id);
};

export default { listComments, createComment, deleteComment };
