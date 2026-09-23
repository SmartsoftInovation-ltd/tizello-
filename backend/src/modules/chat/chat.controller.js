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
 * TWO MOUNTS, ONE SET OF HANDLERS. The workspace channel and a project channel
 * are the same three reads over a different target, so the target is taken
 * from the path — `req.params` — and handed to the service, which owns the
 * access rule for each kind. A second controller would be a second place to
 * forget one.
 *
 * The target is read from the PATH and never from a body field, and the
 * service re-checks the caller's standing regardless, because the socket half
 * has no middleware and the check therefore lives in the service.
 *
 * See .claude/skills/api-response/SKILL.md and docs/api/chat.md §4
 */

import ApiResponse from '../../shared/utils/apiResponse.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import service from './chat.service.js';

/* `{ workspaceId }` or `{ projectId }`, straight off the path. Exactly one is
   present, because the two routers mount on paths that each carry one. */
const targetOf = (req) =>
  req.params.workspaceId
    ? { workspaceId: req.params.workspaceId }
    : { projectId: req.params.projectId };

const list = async (req, res) => {
  const data = await service.listMessages(req.user.id, targetOf(req), req.query);

  return ApiResponse.success(res, httpStatus.OK, 'Messages fetched', data);
};

const unreadCount = async (req, res) => {
  const count = await service.getUnreadCount(req.user.id, targetOf(req));

  return ApiResponse.success(res, httpStatus.OK, 'Unread count fetched', { count });
};

const markRead = async (req, res) => {
  const data = await service.markRead(req.user.id, targetOf(req), req.body);

  return ApiResponse.success(res, httpStatus.OK, 'Channel marked read', data);
};

/** The channel's id and name, so a client can join its socket room. */
const channel = async (req, res) => {
  const { channel: row, name } = await service.resolveChannel(req.user.id, targetOf(req));

  return ApiResponse.success(res, httpStatus.OK, 'Channel fetched', {
    channel: { id: row.id, kind: row.kind, name },
  });
};

export default { list, unreadCount, markRead, channel };
