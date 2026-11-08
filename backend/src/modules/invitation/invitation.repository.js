/**
 * Every Prisma call the invitation module makes.
 *
 * **This repository writes `Membership` rows, a table it does not otherwise
 * own.** That is a deliberate divergence from "one repository per module".
 * Accepting an invitation is a single atomic operation — create the membership,
 * close the invitation — and splitting it across two repositories would put the
 * transaction boundary in the wrong place, between two calls that must not be
 * separable. The rule is *one repository per module*, not one table per module
 * (§6.8).
 *
 * Lookups are by `tokenHash`; nothing here receives a raw token.
 *
 * See docs/api/invitation.md and .claude/skills/module-consistency/SKILL.md
 */

import prisma from '../../config/db.js';

const create = (data, tx = prisma) => tx.invitation.create({ data });

const findById = (id, tx = prisma) => tx.invitation.findUnique({ where: { id } });

const findByTokenHash = (tokenHash, tx = prisma) =>
  tx.invitation.findUnique({
    where: { tokenHash },
    include: { workspace: true, invitedBy: true, customRole: { select: { name: true } } },
  });

/**
 * The one *live* invitation for an address in a workspace, if any.
 *
 * "Live" is the same three-null condition as the partial unique index
 * `invitations_live_email_workspace` created in the sprint 1 migration. The two
 * must agree: this query is what produces a friendly `409 INVITE_PENDING`, and
 * the index is what stops a race between two admins from creating two live rows
 * anyway. Change one without the other and either the check or the constraint
 * starts lying.
 */
const findLive = (email, workspaceId, tx = prisma) =>
  tx.invitation.findFirst({
    where: { email, workspaceId, acceptedAt: null, declinedAt: null, revokedAt: null },
  });

/**
 * Pending invitations for a workspace — what the members screen shows beside
 * the roster.
 *
 * Filtered on the same three nulls plus an unexpired `expiresAt`. The members
 * screen is a list of outstanding invites, not a history log, so a revoked or
 * expired row must not appear even though it is deliberately kept in the table
 * for its audit trail (§3.6).
 */
const listPending = (workspaceId, tx = prisma) =>
  tx.invitation.findMany({
    where: {
      workspaceId,
      acceptedAt: null,
      declinedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { invitedBy: true, customRole: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

const update = (id, data, tx = prisma) => tx.invitation.update({ where: { id }, data });

/* ── Membership — see the file header for why this lives here ──────────── */

const findMembershipByEmail = (email, workspaceId, tx = prisma) =>
  tx.membership.findFirst({ where: { workspaceId, user: { email } } });

const findMembership = (userId, workspaceId, tx = prisma) =>
  tx.membership.findUnique({ where: { userId_workspaceId: { userId, workspaceId } } });

const createMembership = (data, tx = prisma) => tx.membership.create({ data });

/**
 * Re-reads the invitation row with a row-level lock, inside a transaction.
 *
 * Without the lock, an accept racing a revoke can both read the row as live and
 * both succeed — the admin sees the invitation cancelled and the recipient is a
 * member anyway. `FOR UPDATE` makes the second transaction wait for the first to
 * commit, so it sees the outcome rather than the stale state.
 *
 * Raw SQL because Prisma has no `FOR UPDATE` in its query API. `tx` is
 * mandatory here, not defaulted: a row lock outside a transaction is released
 * immediately and would be pure overhead pretending to be a guard.
 */
const lockByIdForUpdate = async (id, tx) => {
  const rows = await tx.$queryRaw`SELECT id FROM invitations WHERE id = ${id} FOR UPDATE`;
  return rows.length > 0;
};

export default {
  create,
  findById,
  findByTokenHash,
  findLive,
  listPending,
  update,
  findMembershipByEmail,
  findMembership,
  createMembership,
  lockByIdForUpdate,
};
