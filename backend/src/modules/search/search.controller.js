/**
 * HTTP edge of the search module: read `req`, call the service, respond via
 * `ApiResponse`. No business logic, no Prisma, no `try/catch`.
 *
 * `req.user` is the whole scope — there is no `:workspaceId` in the path and
 * no id in the query, because the answer is "everything you can see". Taking a
 * workspace from the caller would make it possible to ASK about a workspace
 * you do not belong to; resolving memberships from `req.user.id` makes that
 * unrepresentable.
 *
 * See .claude/skills/api-response/SKILL.md and docs/api/search.md
 */

import ApiResponse from '../../shared/utils/apiResponse.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import service from './search.service.js';

const search = async (req, res) => {
  const results = await service.search(req.user, req.query);

  return ApiResponse.success(res, httpStatus.OK, 'Search results fetched', results);
};

export default { search };
