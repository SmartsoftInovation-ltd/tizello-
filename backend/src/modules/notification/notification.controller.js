/**
 * HTTP edge of the notification module: read `req`, call the service, respond
 * via `ApiResponse`. No business logic, no Prisma, no `try/catch` —
 * `asyncHandler` at the routes layer forwards a rejection to the error
 * middleware.
 *
 * Every handler reads `req.user.id` and nothing else identifies the owner.
 * There is no `:userId` anywhere in this module's paths, and that is the
 * design: a route that took one would be a route somebody could change.
 *
 * See .claude/skills/api-response/SKILL.md and docs/api/notification.md
 */

import ApiResponse from '../../shared/utils/apiResponse.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import AppError from '../../shared/utils/AppError.js';
import { AUTH_CODES } from '../../shared/constants/authCodes.js';
import service from './notification.service.js';

/* The list carries `unreadCount` rather than making the bell call twice: the
   badge and the dropdown are drawn from one render, and two endpoints could
   disagree by whatever arrived between them. */
const list = async (req, res) => {
  const data = await service.list(req.user.id, req.query);

  return ApiResponse.success(res, httpStatus.OK, 'Notifications fetched', data);
};

const unreadCount = async (req, res) => {
  const count = await service.unreadCount(req.user.id);

  return ApiResponse.success(res, httpStatus.OK, 'Unread count fetched', { count });
};

const markRead = async (req, res) => {
  const notification = await service.markRead(req.user.id, req.params.notificationId);

  /* Unknown and somebody-else's are the same `404`. Answering `403` to the
     second confirms the id is live for another user — the same leak
     `loadMembership` refuses by 404-ing a non-member. */
  if (!notification) {
    throw new AppError(httpStatus.NOT_FOUND, 'Notification not found', AUTH_CODES.NOT_FOUND);
  }

  return ApiResponse.success(res, httpStatus.OK, 'Notification read', { notification });
};

const markAllRead = async (req, res) => {
  const { count } = await service.markAllRead(req.user.id);

  return ApiResponse.success(res, httpStatus.OK, 'Notifications read', { count });
};

export default { list, unreadCount, markRead, markAllRead };
