/**
 * The project authorization ladder, as a plain function.
 *
 * ONE DEFINITION, TWO TRANSPORTS. `shared/middlewares/project.js` used to hold
 * both the ladder and the Express plumbing around it, which was fine while
 * every caller was a request. Chat's writes arrive on a Socket.IO connection,
 * and a socket has no `req`, no `res` and no `next` — so a handler that needed
 * this rule had exactly two options: call middleware it cannot call, or grow
 * its own copy of the ladder. The second is how a channel ends up readable by
 * someone the REST API refuses, which is why this file exists.
 *
 * It takes ids and returns data. No Express, no `AppError`, no throwing: the
 * REST wrapper turns `null` into its 404 and the socket layer turns it into a
 * `chat:error`, because a socket has no error middleware to catch a throw.
 *
 * The ladder itself is unchanged and still documented where it always was —
 * `shared/middlewares/project.js` and .claude/plan/project.md §2.5. In short:
 *
 *   1. no workspace membership     -> null (the caller never learns it exists)
 *   2. workspace OWNER/ADMIN       -> full access, the escape hatch
 *   3. otherwise the project role decides
 *   4. workspace MEMBER, no ProjectMember row -> read-only
 *
 * **Ownership is `project.ownerId` and nothing else.** The `ProjectMember` row
 * with `role: OWNER` is a display mirror (plan §2.4); reading the role off it
 * here would be a bug.
 *
 * See .claude/plan/chat.md §4.2, docs/api/chat.md §1
 */

import prisma from '../../config/db.js';
import { PERMISSIONS, membershipCan } from '../constants/roles.js';

/**
 * The ladder's conclusions, from rows somebody else already loaded.
 *
 * Split out of `resolveProjectAccess` for exactly one caller: `loadTask` reads
 * a task and its project in a single joined query, and making it call the
 * resolver afterwards would re-read the project it already has — a third round
 * trip on the hottest routes in the app. It gets the same three answers from
 * this function instead, so the two paths cannot disagree while they compute
 * the same fields from the same inputs.
 *
 * Pure. No queries, no throwing.
 */
const projectAccessFlags = ({ project, membership, projectMember, userId }) => {
  const escalated = membershipCan(membership, PERMISSIONS.PROJECT_MANAGE_ANY);
  const owns = project.ownerId === userId;

  return {
    projectRole: owns ? 'OWNER' : (projectMember?.role ?? null),
    canContribute: escalated || owns || Boolean(projectMember),
    canWrite: escalated || owns || projectMember?.role === 'MANAGER',
  };
};

/**
 * Resolves what `userId` may do with `projectId`.
 *
 * Returns `null` for every "you cannot see this" case — no such project, a
 * soft-deleted one, or one in a workspace the caller is not in. They are one
 * answer on purpose: confirming a project exists to somebody with no access to
 * it is itself the leak.
 *
 * Otherwise:
 *
 *   project        the row (never soft-deleted)
 *   membership     the caller's Membership in the project's workspace
 *   projectMember  their ProjectMember row, or null
 *   projectRole    OWNER / MANAGER / COLLABORATOR / null — for the DTO
 *   canContribute  may write task rows and chat messages: escalated, owner, or
 *                  anyone with a ProjectMember row
 *   canWrite       may manage the project itself: escalated, owner, or MANAGER
 *
 * The two flags are computed here rather than by each caller so the two
 * transports cannot drift — see the header.
 */
/**
 * The `include` that loads a project together with BOTH halves of the
 * caller's access — their project membership and their workspace membership —
 * in ONE query (with `relationJoins` on, see schema.prisma). It used to be two
 * sequential round trips, because the workspace membership was looked up by
 * the project's `workspaceId` after the project came back; reaching it through
 * `project.workspace.memberships` needs no second trip. The membership is the
 * bare row, exactly what the old `findUnique` returned.
 *
 * Shared by `resolveProjectAccess` (below), `loadSprint` and `loadTask`.
 */
const projectWithAccess = (userId) => ({
  include: {
    members: { where: { userId } },
    workspace: { select: { memberships: { where: { userId }, take: 1 } } },
  },
});

/**
 * Splits a project loaded with `projectWithAccess` back into the project row
 * — shape unchanged, no `workspace` key leaks into `req.project` — and the
 * workspace membership, `null` when the caller is not a member.
 */
const splitAccess = ({ workspace, ...project }) => ({
  project,
  membership: workspace?.memberships?.[0] ?? null,
});

const resolveProjectAccess = async (userId, projectId) => {
  if (!userId || !projectId) return null;

  const row = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    ...projectWithAccess(userId),
  });

  if (!row) return null;

  const { project, membership } = splitAccess(row);

  // Step 1 of the ladder. Not a member of the workspace the project lives in
  // is the same answer as a project that does not exist, never a 403.
  if (!membership) return null;

  const projectMember = project.members[0] ?? null;

  return {
    project,
    membership,
    projectMember,
    ...projectAccessFlags({ project, membership, projectMember, userId }),
  };
};

export { resolveProjectAccess, projectAccessFlags, projectWithAccess, splitAccess };
export default { resolveProjectAccess, projectAccessFlags, projectWithAccess, splitAccess };
