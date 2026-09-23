/**
 * Workspace membership, as a plain function — the companion to
 * `project-access.js`, and it exists for the same reason: a socket has no
 * `req`, so `loadMembership` in `shared/middlewares/permission.js` cannot
 * answer "is this person in this workspace" for a chat connection.
 *
 * It takes ids and returns data. No Express, no `AppError`, no throwing: the
 * caller decides what a `null` means, because the REST half turns it into a
 * `404` and the socket half into a `chat:error`.
 *
 * THE LADDER IS ONE RUNG. A workspace channel is readable and writable by
 * EVERY member — that is the point of it, and it is deliberately wider than
 * any project channel, where a workspace member who is not on the project is
 * refused. The only tier that matters beyond membership is moderation:
 * deleting somebody else's message takes OWNER or ADMIN, the same pair that
 * may remove a member.
 *
 * See docs/api/chat.md §1
 */

import prisma from '../../config/db.js';
import { roleAtLeast } from '../constants/roles.js';

/**
 * Resolves what `userId` may do in `workspaceId`.
 *
 * `null` when there is no membership, or the workspace is soft-deleted — one
 * answer, because confirming a workspace exists to somebody with no access to
 * it is itself the leak that `loadMembership` refuses by 404-ing a non-member.
 *
 *   workspace     the row (never soft-deleted)
 *   membership    the caller's Membership
 *   canContribute always true for a member — named to match
 *                 `project-access.js` so a caller can treat the two alike
 *   canModerate   OWNER or ADMIN: may delete somebody else's message
 */
const resolveWorkspaceAccess = async (userId, workspaceId) => {
  if (!userId || !workspaceId) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    include: { workspace: true },
  });

  if (!membership || !membership.workspace || membership.workspace.deletedAt) return null;

  const { workspace, ...row } = membership;

  return {
    workspace,
    membership: row,
    canContribute: true,
    canModerate: roleAtLeast(row.role, 'ADMIN'),
  };
};

export { resolveWorkspaceAccess };
export default { resolveWorkspaceAccess };
