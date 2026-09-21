/**
 * Member business rules: the roster read, role changes, and removal.
 *
 * **Authorization is not this file's job.** `loadMembership` and
 * `requirePermission` (shared/middlewares/permission.js) have already run by the
 * time anything below executes, so there is no role check here — every guard in
 * this file is about *state*: who the TARGET is, not what the caller may do.
 * The two questions are separate, and a `role === 'ADMIN'` test in a service is
 * how the permission table stops being the answer to "who may do this".
 *
 * Three rules shape almost everything below.
 *
 * **1. Membership is the only fact about who is in a workspace.** There is no
 * `Workspace.ownerId` column — "the owner" is the membership whose role is
 * OWNER. A workspace with no OWNER membership is unrecoverable: nothing can
 * delete it, bill it, or change a role in it, because each needs a permission
 * only OWNER holds. Everything that could reduce the owner count is refused.
 *
 * **2. Unknown and elsewhere are the same answer.** A `:memberId` that never
 * existed and one that is live in ANOTHER workspace both answer `404`.
 * Answering `403` on the second confirms to an admin of workspace A that a
 * membership id is live in workspace B — a membership-existence oracle across a
 * trust boundary, the same leak `loadMembership` refuses by `404`-ing a
 * non-member.
 *
 * **3. Removal is not idempotent; a role change is.** A second `DELETE` on the
 * same id answers `404`, because a membership id is not a stable handle for a
 * person — it is gone, and the next invitation mints a new one. Setting a role a
 * member already holds succeeds. The asymmetry is which mistake is worse:
 * reporting success for a removal that did not happen tells an admin someone is
 * out when they are not.
 *
 * See docs/api/member.md and .claude/plan/member.md §§2.3-2.6
 */

import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import { AUTH_CODES } from '../../shared/constants/authCodes.js';
import { ROLES } from '../../shared/constants/roles.js';
import repository from './member.repository.js';
import dto from './member.dto.js';
import roleService from '../role/role.service.js';

/** The one `404` every unknown-or-elsewhere membership collapses into. See rule 2. */
const notFound = () =>
  new AppError(httpStatus.NOT_FOUND, 'Member not found', AUTH_CODES.NOT_FOUND);

/**
 * `422`, not `400`, for every state refusal below: the request is well-formed
 * and each value is individually legal — it is the state that forbids it. The
 * same distinction `invitation.service.js` draws when it answers `422` to
 * `role: "OWNER"`.
 */
const unprocessable = (message) =>
  new AppError(httpStatus.UNPROCESSABLE_ENTITY, message, AUTH_CODES.VALIDATION_ERROR);

/**
 * Resolves `:memberId` within the workspace from the path, or throws the one
 * `404`.
 *
 * The workspace comparison happens here rather than in the repository `where`
 * so that both cases take one code path to one error — see rule 2.
 */
const findMemberOrThrow = async (workspaceId, memberId) => {
  const member = await repository.findMembershipById(memberId);

  if (!member || member.workspaceId !== workspaceId) throw notFound();

  return member;
};

/**
 * The last-owner guard.
 *
 * **Redundant today, and written anyway.** `assertNotOwner` below already makes
 * an OWNER's role unchangeable and an OWNER unremovable, so the count cannot
 * reach zero by either path — this never fires. It is the invariant; those rules
 * are merely where it currently bites. The moment ownership transfer or
 * leave-workspace lands, they stop covering every path and this is the only
 * thing between a typo and a workspace nobody can administer (rule 1).
 *
 * Not dead code. Deleting it removes the guard and leaves the two rules that
 * happen to imply it, which is a different and weaker program.
 */
const assertNotLastOwner = async (member) => {
  if (member.role !== ROLES.OWNER) return;

  const owners = await repository.countOwners(member.workspaceId);

  if (owners <= 1) {
    throw unprocessable('This is the workspace’s only owner and cannot be changed or removed.');
  }
};

/**
 * The OWNER is untouchable through this module.
 *
 * Changing their role is the demotion half of an ownership transfer, reachable
 * on its own; removing them is the same loss by a blunter route. Either one,
 * allowed, is exactly how a workspace reaches zero owners. Transfer is its own
 * future endpoint and must be a single transaction that demotes the outgoing
 * owner — not two requests with a window in between where the workspace has two
 * owners or none.
 */
const assertNotOwner = (member, message) => {
  if (member.role === ROLES.OWNER) throw unprocessable(message);
};

/**
 * `GET /workspaces/:workspaceId/members`. The roster the members screen, the
 * invite dialog and the project collaborator picker all read.
 *
 * No pagination: a workspace's membership is bounded by its seat count and every
 * caller wants the whole list to resolve names with. When that stops being true
 * it gains `page`/`limit` like the others.
 */
const listMembers = async (workspaceId) => {
  const rows = await repository.findMembers(workspaceId);

  return rows.map(dto.toMember);
};

/**
 * `PATCH /workspaces/:workspaceId/members/:memberId`.
 *
 * `role: OWNER` is re-checked here even though the validator omits it from its
 * `valid()` list. That duplication is the point: this endpoint grants workspace
 * authority, and a service reachable from a worker or a script must not depend
 * on an HTTP-layer validator having run.
 *
 * Setting the role a member already holds is a successful no-op returning the
 * same row — reporting failure for a state the caller asked for and got would be
 * wrong (rule 3).
 *
 * A demotion takes effect on the member's NEXT request: roles are read per
 * request by `loadMembership`, never cached and never baked into the access
 * token. That is why `auth.md` keeps the token payload to an identity — a role
 * in a JWT stays true for fifteen minutes after it stops being true.
 */
const changeRole = async ({ workspaceId, memberId, role, roleId, actorMembership }) => {
  if (role === ROLES.OWNER) {
    throw unprocessable('Ownership is transferred, never granted by a role change.');
  }

  /* A workspace-defined role, when one was named. Resolved BEFORE any state
     check so an unknown id answers 404 rather than passing every guard and
     failing on the write with a foreign-key error the client cannot read. */
  const custom = roleId ? await roleService.findAssignable(workspaceId, roleId) : null;

  if (custom?.baseRole === ROLES.OWNER) {
    throw unprocessable('Ownership is transferred, never granted by a role change.');
  }

  const member = await findMemberOrThrow(workspaceId, memberId);

  assertNotOwner(
    member,
    'A workspace owner’s role is changed by transferring ownership, not here.'
  );

  // Self-demotion is the one role change nobody can undo: an ADMIN who drops to
  // MEMBER loses the permission needed to climb back, and the only recovery is
  // another admin or the database.
  if (member.id === actorMembership.id) {
    throw unprocessable('You cannot change your own role.');
  }

  await assertNotLastOwner(member);

  /* The tier follows the custom role's rung. Two columns, one decision: the
     grant comes from `roleId`, the ladder from `role`, and letting them
     disagree would mean a "Reviewer" sitting on ADMIN for `roleAtLeast` and on
     MEMBER for everything else. An explicit `role` in the request still wins
     when no custom role was named. */
  const tier = custom ? custom.baseRole : role;

  if (member.role === tier && (member.roleId ?? null) === (custom?.id ?? null)) {
    return dto.toMember(member);
  }

  const updated = await repository.updateRole(member.id, {
    role: tier,
    roleId: custom?.id ?? null,
  });

  return dto.toMember(updated);
};

/**
 * `DELETE /workspaces/:workspaceId/members/:memberId`.
 *
 * Refuses before it deletes, in this order: unknown → `404`, owner → `422`,
 * self → `422`, last owner → `422`, owns a project → `409`. Order matters only
 * in that `404` comes first: an unknown id must never reveal which rule it would
 * have hit.
 */
const removeMember = async ({ workspaceId, memberId, actorMembership }) => {
  const member = await findMemberOrThrow(workspaceId, memberId);

  assertNotOwner(member, 'A workspace owner cannot be removed. Transfer ownership first.');

  // Self-removal is a different operation with a different guard — an ADMIN
  // removing themselves is *leaving*, which needs no `member:remove`, and
  // putting a plain MEMBER's exit behind a permission they do not hold would be
  // wrong. This `422` is what keeps that gap visible instead of letting this
  // endpoint quietly double as it. See docs/api/member.md open question 2.
  if (member.id === actorMembership.id) {
    throw unprocessable('Use leave workspace to remove yourself.');
  }

  await assertNotLastOwner(member);

  // `Project.ownerId` is `onDelete: Restrict` precisely so that losing a user
  // never silently orphans projects. Removing them from the workspace is the
  // same loss by a different route, so it gets the same answer. The projects are
  // named in `data.projects` so the client can say "transfer these three first"
  // rather than "something went wrong" — auto-reassigning them to the actor
  // would make an irreversible ownership change a side effect of a destructive
  // action the caller thought they understood.
  const owned = await repository.findOwnedProjects(workspaceId, member.userId);

  if (owned.length > 0) {
    throw new AppError(
      httpStatus.CONFLICT,
      'This member owns projects in this workspace. Transfer or delete them first.',
      AUTH_CODES.CONFLICT,
      { projects: owned.map(dto.toOwnedProject) }
    );
  }

  await repository.removeMember({
    membershipId: member.id,
    workspaceId,
    userId: member.userId,
  });
};

export default { listMembers, changeRole, removeMember, findMemberOrThrow };
