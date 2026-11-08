/**
 * Row → response shaping for invitations.
 *
 * **Status is derived here, never stored.** There is no `status` column: a
 * second source of truth drifts the moment one write path forgets to update it,
 * and the four timestamps that actually record what happened are the ones an
 * audit needs anyway (§3.6).
 *
 * The order of the checks is the contract, not an implementation detail. A row
 * can carry several of these at once — a revoked invitation that has also
 * expired, an accepted one whose `expiresAt` has since passed — and the first
 * match wins. Reordering silently changes what the members screen reports about
 * rows nobody is looking at until they are.
 *
 * See docs/api/invitation.md and .claude/specs/auth/auth.sprint7.md §7.4
 */

const STATUS = {
  REVOKED: 'REVOKED',
  DECLINED: 'DECLINED',
  ACCEPTED: 'ACCEPTED',
  EXPIRED: 'EXPIRED',
  PENDING: 'PENDING',
};

const statusOf = (row) => {
  if (row.revokedAt) return STATUS.REVOKED;
  if (row.declinedAt) return STATUS.DECLINED;
  if (row.acceptedAt) return STATUS.ACCEPTED;
  if (row.expiresAt <= new Date()) return STATUS.EXPIRED;
  return STATUS.PENDING;
};

/**
 * The admin-facing shape, for the members screen.
 *
 * A whitelist, like `auth.dto.js` — and `tokenHash` is the reason it matters
 * here. Listing invitations is an authenticated, permissioned call, but the
 * hash still has no business leaving the server, and a `delete row.tokenHash`
 * approach would leak whatever column is added next.
 */
const toInvitation = (row) => ({
  id: row.id,
  email: row.email,
  role: row.role,
  roleId: row.roleId ?? null,
  roleName: row.customRole?.name ?? null,
  status: statusOf(row),
  invitedByName: row.invitedBy?.name ?? null,
  expiresAt: row.expiresAt,
  createdAt: row.createdAt,
});

/**
 * The **public** shape, returned by `GET /invitations/:token` to a caller with
 * no account at all.
 *
 * **This is a ceiling, not a starting point** (§6.7). Whoever holds the token is
 * an unauthenticated stranger — possibly not the intended recipient — so the
 * response is capped at what the invitation email already told them: which
 * workspace, who invited them, what role. No member list, no member count, no
 * inviter email, no workspace settings. Every field added here is disclosed to
 * anyone who obtains a link.
 */
const toPublicInvitation = (row, token) => ({
  token,
  workspaceId: row.workspaceId,
  workspaceName: row.workspace.name,
  invitedByName: row.invitedBy?.name ?? null,
  role: row.role,
  // The role's display name only — never its permission list, which this
  // unauthenticated shape must not disclose.
  roleName: row.customRole?.name ?? null,
});

export default { toInvitation, toPublicInvitation, statusOf, STATUS };
export { toInvitation, toPublicInvitation, statusOf, STATUS };
