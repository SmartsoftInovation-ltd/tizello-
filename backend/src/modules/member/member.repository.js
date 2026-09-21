/**
 * Every Prisma call the member module makes. No business rules — the service
 * decides what a request means; this file only knows how to read and write the
 * rows.
 *
 * **This repository reads `Project` and writes `ProjectMember`, tables the
 * project module owns.** That is a deliberate divergence from "one repository
 * per module", and the same one `invitation.repository.js` takes when it writes
 * `Membership`: removing someone from a workspace must strip their project rows
 * in the SAME transaction, and splitting that across two repositories would put
 * the transaction boundary between two statements that must not be separable.
 * The rule is *one repository per module*, not one table per module.
 *
 * See docs/api/member.md, .claude/plan/member.md §2.5
 *      and .claude/skills/module-consistency/SKILL.md
 */

import prisma from '../../config/db.js';
import { ROLES } from '../../shared/constants/roles.js';

// The three user fields a roster may expose, selected AT THE QUERY rather than
// only in the DTO — a roster must never be a route to `passwordHash` or
// `emailVerifiedAt`, and a `select` guarantees that without trusting a later
// reader to remember. Shared by both reads below so the two cannot drift.
const ROSTER_USER_SELECT = { select: { id: true, name: true, email: true } };

/* Just enough of the role for a roster row to name it. The permission array is
   deliberately absent: the roster lists who holds what, and shipping every
   member's full grant with it would be a payload nobody reads. */
const ROSTER_ROLE_SELECT = { select: { id: true, name: true, baseRole: true } };

/**
 * Everyone in the workspace, owner first.
 *
 * `Role` is declared OWNER, ADMIN, MEMBER and Postgres orders an enum by
 * DECLARATION order, so `role: 'asc'` is most-privileged first without a `CASE`.
 * Reordering the enum in schema.prisma would silently reorder this response.
 */
const findMembers = (workspaceId) =>
  prisma.membership.findMany({
    where: { workspaceId },
    include: { user: ROSTER_USER_SELECT, customRole: ROSTER_ROLE_SELECT },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });

/**
 * One membership by its own id — NOT by `(userId, workspaceId)`.
 *
 * The workspace is deliberately not in the `where`: the service compares
 * `row.workspaceId` itself so that "no such membership" and "a membership in
 * another workspace" take the same code path to the same `404`. Filtering here
 * would make the second case indistinguishable by accident rather than by
 * decision, and the decision is the part worth keeping.
 */
const findMembershipById = (id) =>
  prisma.membership.findUnique({ where: { id }, include: { user: ROSTER_USER_SELECT } });

/** How many OWNER memberships the workspace has. The input to the last-owner guard. */
const countOwners = (workspaceId) =>
  prisma.membership.count({ where: { workspaceId, role: ROLES.OWNER } });

/* Takes the whole patch rather than a bare tier, because assigning a custom
   role writes two columns at once: `roleId` (whose grant applies) and `role`
   (the rung it sits on, which `roleAtLeast` still walks). Writing one without
   the other is the bug this signature exists to make impossible. */
const updateRole = (id, data) =>
  prisma.membership.update({
    where: { id },
    data,
    include: { user: ROSTER_USER_SELECT, customRole: ROSTER_ROLE_SELECT },
  });

/**
 * Projects in this workspace that this user owns, if any.
 *
 * `deletedAt: null` because a soft-deleted project is not a reason to block a
 * removal — nothing can reach it to transfer it, so requiring that would be an
 * unsatisfiable condition. Ownership is read from `Project.ownerId`, never from
 * a `ProjectMember` row with `role: OWNER`: that row is a display mirror (see
 * .claude/plan/project.md §2.4).
 */
const findOwnedProjects = (workspaceId, userId) =>
  prisma.project.findMany({
    where: { workspaceId, ownerId: userId, deletedAt: null },
    select: { id: true, name: true, key: true },
    orderBy: { createdAt: 'asc' },
  });

/**
 * Removes a member: deletes the `Membership` AND their `ProjectMember` rows in
 * this workspace's projects, in ONE transaction.
 *
 * Both halves are required. Deleting the membership alone already evicts the
 * user from every project — `shared/middlewares/project.js` step 1 is *no
 * workspace membership → 404* — but `ProjectMember` cascades from `Project` and
 * `User`, not from `Membership`, so the rows survive and the removed person
 * keeps appearing in every member panel and assignee picker: present in the UI,
 * refused by the API.
 *
 * One transaction because a partial apply is a user locked out of the workspace
 * while still listed on its projects. Scoped by `project: { workspaceId }` so a
 * removal from one workspace never touches their projects in another.
 */
const removeMember = ({ membershipId, workspaceId, userId }) =>
  prisma.$transaction(async (tx) => {
    await tx.membership.delete({ where: { id: membershipId } });

    await tx.projectMember.deleteMany({
      where: { userId, project: { workspaceId } },
    });
  });

export default {
  findMembers,
  findMembershipById,
  countOwners,
  updateRole,
  findOwnedProjects,
  removeMember,
};
