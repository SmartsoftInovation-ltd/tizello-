/**
 * Project-scoped authorization. Resolves the two-layer ladder — the caller's
 * WORKSPACE role and their PROJECT role — once, in one place, so no service
 * anywhere grows an `if (role === …)` of its own.
 *
 * A new file rather than an addition to `permission.js`: that file is
 * workspace-scoped by construction and is imported by modules with no concept
 * of a project. Keeping the project ladder beside it, not inside it, leaves
 * both greppable.
 *
 * The ladder, in fixed order (see .claude/plan/project.md §2.5):
 *
 *   1. no workspace membership -> 404. A non-member never learns the project
 *      exists; confirming existence is itself the leak, exactly as
 *      `loadMembership` argues.
 *   2. workspace OWNER/ADMIN (PROJECT_MANAGE_ANY) -> full access to every
 *      project in the workspace. Without this escape hatch a workspace admin
 *      can be locked out of a project in their own workspace by a collaborator
 *      who removes them, recoverable only from the database.
 *   3. otherwise the project role decides — owner and MANAGER may write.
 *   4. workspace MEMBER with no ProjectMember row -> read-only. Projects are
 *      visible workspace-wide; there is no private-project flag in this schema.
 *
 * **Ownership is read from `req.project.ownerId` and nowhere else.** The
 * `ProjectMember` row with `role: OWNER` is a mirror kept for display (plan
 * §2.4); a `projectMember.role === 'OWNER'` check in this file would be a bug.
 *
 * **THE LADDER ITSELF NOW LIVES IN `shared/services/project-access.js`.** This
 * file is its Express half: `loadProject` calls the resolver and stamps the
 * result on `req`, and the four guards below read flags the resolver already
 * computed. The socket layer calls the same resolver, which is the only reason
 * a chat channel and a REST endpoint cannot disagree about who is a member.
 * Recomputing a rule here rather than reading its flag would reintroduce
 * exactly the drift that split was for.
 *
 * `requireProjectContribute` and `markProjectWriter` MOVED HERE from
 * `middlewares/task.js`, where they landed because the task module was their
 * first caller. Neither has anything to do with tasks — chat is now the second
 * caller of both — and a permission tier filed under an unrelated resource is
 * one nobody finds. `loadTask` stays in `task.js`; it loads a task.
 *
 * All of these run AFTER `authGuard`.
 */

import AppError from '../utils/AppError.js';
import httpStatus from '../constants/httpStatus.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AUTH_CODES } from '../constants/authCodes.js';
import { PERMISSIONS, membershipCan } from '../constants/roles.js';
import { resolveProjectAccess } from '../services/project-access.js';

const FORBIDDEN = () =>
  new AppError(
    httpStatus.FORBIDDEN,
    'You do not have permission to perform this action',
    AUTH_CODES.FORBIDDEN
  );

// The one 404 every "you cannot see this" case collapses into: a soft-deleted
// project, a project in someone else's workspace, and an id that never existed
// all answer identically.
const notFound = () =>
  new AppError(httpStatus.NOT_FOUND, 'Project not found', AUTH_CODES.NOT_FOUND);

/**
 * Loads the project named by the route plus both of the caller's roles, and
 * puts them on the request:
 *
 *   req.project         the row (never soft-deleted)
 *   req.membership      their Membership in the project's workspace
 *   req.projectMember   their ProjectMember row, or null
 *   req.projectRole     the effective role for the DTO — OWNER / MANAGER /
 *                       COLLABORATOR / null
 *   req.canWriteProject the `requireProjectWrite` rule as a flag, for the one
 *                       decision that is "the author, OR a project writer"
 */
const loadProject = asyncHandler(async (req, res, next) => {
  const { projectId } = req.params;

  if (!projectId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'projectId is required',
      AUTH_CODES.VALIDATION_ERROR
    );
  }

  const access = await resolveProjectAccess(req.user.id, projectId);

  // Steps 1 and "no such project" of the ladder. The resolver returns null for
  // both, deliberately, and this is where that becomes a status code.
  if (!access) throw notFound();

  req.project = access.project;
  req.membership = access.membership;
  req.projectMember = access.projectMember;
  req.projectRole = access.projectRole;
  req.canContributeProject = access.canContribute;
  req.canWriteProject = access.canWrite;

  next();
});

/** Step 2 or 3 of the ladder: workspace OWNER/ADMIN, the project owner, or a MANAGER. */
const requireProjectWrite = (req, res, next) => {
  if (!req.canWriteProject) return next(FORBIDDEN());

  next();
};

/**
 * Stricter: workspace OWNER/ADMIN or the project owner. A MANAGER is not enough.
 *
 * The one guard that still evaluates the rule itself rather than reading a
 * resolver flag, because it is the only tier no other caller needs: adding a
 * `canOwn` would be a field computed on every socket connection to serve four
 * Express routes. `canWriteProject` is NOT a substitute — it is true for a
 * MANAGER, which is precisely who this guard exists to refuse.
 */
const requireProjectOwner = (req, res, next) => {
  const escalated = membershipCan(req.membership, PERMISSIONS.PROJECT_MANAGE_ANY);
  const owns = req.project?.ownerId === req.user.id;

  if (!escalated && !owns) return next(FORBIDDEN());

  next();
};

/**
 * THE CONTRIBUTE TIER. `requireProjectWrite` (workspace OWNER/ADMIN, project
 * owner, MANAGER) does not fit a task row or a chat message: a COLLABORATOR is
 * somebody who was added to the project to do the work, and a collaborator who
 * can read the backlog but cannot file a task or say anything in the channel is
 * not collaborating. So task rows and chat messages take this wider tier —
 * anyone with a `ProjectMember` row, plus the workspace escape hatch — while a
 * project's task SCHEMA stays behind `requireProjectWrite`, exactly as the
 * workspace's project schema stays behind `PROJECT_MANAGE_ANY`.
 *
 * A workspace MEMBER who is not on the project stays read-only on the project
 * (ladder step 4) and is refused here. For chat that means such a person can
 * see the project and cannot read its channel — see docs/api/chat.md §1, where
 * it is argued rather than inherited.
 *
 * Runs after `loadProject` or `loadTask`.
 */
const requireProjectContribute = (req, res, next) => {
  if (!req.canContributeProject) return next(FORBIDDEN());

  next();
};

/**
 * Stamps `req.canWriteProject` and never rejects — a no-op now that
 * `loadProject` and `loadTask` both stamp it, kept as a route-level marker.
 *
 * It exists for the one decision that is "the author, OR a project writer":
 * deleting a comment, or deleting a chat message. A gate would lock authors out
 * of their own; checking the rule inside the service would put a role check in
 * a service, which this file exists to prevent. The flag keeps the ladder in
 * middleware and leaves the author comparison — which needs the row — to the
 * service.
 *
 * Kept in the route chain rather than deleted because a route that reads
 * `canWriteProject` in its service should say so where the guards are listed.
 */
const markProjectWriter = (req, res, next) => {
  next();
};

export {
  loadProject,
  requireProjectWrite,
  requireProjectOwner,
  requireProjectContribute,
  markProjectWriter,
};
