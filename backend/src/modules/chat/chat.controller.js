/**
 * HTTP edge of the chat module: read `req`, call the service, respond via
 * `ApiResponse`. No business logic, no Prisma, no `try/catch` — `asyncHandler`
 * at the routes layer forwards a rejection to the error middleware.
 *
 * **THE REST HALF IS HISTORY ONLY.** There is no `POST /messages`: sending is
 * a socket event. A REST twin would be a second write path with its own
 * broadcast to forget, and the one thing this module must guarantee is that no
 * message exists without having been broadcast and no broadcast happens
 * without a row. docs/api/chat.md, divergence 5.
 *
 * The workspace is read from the PATH and never from a body field, and the
 * service re-checks the caller's membership regardless, because the socket
 * half has no middleware and the check therefore lives in the service.
 *
 * See .claude/skills/api-response/SKILL.md and docs/api/chat.md §4
 */

import ApiResponse from '../../shared/utils/apiResponse.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import service from './chat.service.js';

const list = async (req, res) => {
  const data = await service.listMessages(req.user.id, req.params.workspaceId, req.query);

  return ApiResponse.success(res, httpStatus.OK, 'Messages fetched', data);
};

const unreadCount = async (req, res) => {
  const count = await service.getUnreadCount(req.user.id, req.params.workspaceId);

  return ApiResponse.success(res, httpStatus.OK, 'Unread count fetched', { count });
};

const markRead = async (req, res) => {
  const data = await service.markRead(req.user.id, req.params.workspaceId, req.body);

  return ApiResponse.success(res, httpStatus.OK, 'Channel marked read', data);
};

export default { list, unreadCount, markRead };
