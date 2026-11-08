/**
 * Invitation business rules — the admin side (sprint 7) and the recipient side
 * (sprint 8).
 *
 * Two rules shape almost everything below.
 *
 * **1. Dead invitations are indistinguishable from ones that never existed.**
 * Revoked, declined, already-accepted and never-minted all answer `404` on the
 * public lookup. The frontend's `InvitationLookup` type has exactly three
 * states, and the shipped copy for `UNKNOWN` already reads *"mistyped,
 * cancelled, or already used"* — inventing a fourth state breaks the page rather
 * than informing it. It also matters for security: distinguishing *revoked* from
 * *never existed* tells a token-guesser that a token was once real.
 *
 * **2. Accepting is idempotent.** A double-clicked Accept, a retried request, a
 * user already in the workspace — all return `200` with the membership. Reporting
 * failure for something that already succeeded is worse than doing nothing.
 *
 * See docs/api/invitation.md, .claude/specs/auth/auth.sprint7.md and auth.sprint8.md
 */

import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import { AUTH_CODES } from '../../shared/constants/authCodes.js';
import { ROLES, permissionsFor } from '../../shared/constants/roles.js';
import roleService from '../role/role.service.js';
import config from '../../config/env.js';
import prisma from '../../config/db.js';
import { mintOpaqueToken, hashToken } from '../../shared/utils/tokens.js';
import { enqueueInvitationEmail } from '../../queues/email.queue.js';
import authRepository from '../auth/auth.repository.js';
import repository from './invitation.repository.js';
import dto from './invitation.dto.js';

const DAY = 24 * 60 * 60 * 1000;

const expiryFromNow = () => new Date(Date.now() + config.invite.ttlDays * DAY);

/** The single `404` every dead-or-missing invitation collapses into. See rule 1. */
const notFound = () =>
  new AppError(httpStatus.NOT_FOUND, 'This invitation is no longer valid', AUTH_CODES.NOT_FOUND);

/**
 * Creates an invitation and queues the email.
 *
 * The role is re-checked here even though the validator already restricted it.
 * That duplication is the point: this endpoint mints workspace access, and a
 * service reachable from a worker or a script must not depend on an HTTP-layer
 * validator having run.
 */
const createInvitation = async ({ workspaceId, email, role, roleId = null, invitedById, inviterMembership }) => {
  /* A workspace-defined role, when one was named. Its `baseRole` is the rung
     the invitee joins on — the same two-column rule `member.service`'s
     changeRole applies, so an accepted invite and a later role change agree.
     An unknown id is the role module's 404. */
  const custom = roleId ? await roleService.findAssignable(workspaceId, roleId) : null;
  if (custom) role = custom.baseRole;

  /* No escalation by invitation: the role cannot grant a permission the
     inviter does not hold — the same ceiling `resolveGrant` puts on authoring
     a role. Without it, anyone with `members.invite` could hand a new account
     a role more powerful than their own. */
  if (custom && inviterMembership) {
    const ceiling = permissionsFor(inviterMembership);
    if (custom.permissions.some((id) => !ceiling.includes(id))) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You cannot invite someone with a role that has more permissions than yours',
        AUTH_CODES.FORBIDDEN
      );
    }
  }

  if (role === ROLES.OWNER) {
    throw new AppError(
      httpStatus.UNPROCESSABLE_ENTITY,
      'Ownership is transferred, never granted by invitation',
      AUTH_CODES.VALIDATION_ERROR
    );
  }

  // Already in the workspace: a token that could only ever be a no-op should not
  // be minted at all (§6.5).
  if (await repository.findMembershipByEmail(email, workspaceId)) {
    throw new AppError(
      httpStatus.CONFLICT,
      'That person is already a member of this workspace',
      AUTH_CODES.ALREADY_MEMBER
    );
  }

  // A live invitation already exists. The partial unique index enforces this at
  // the database level too; this check exists to produce a useful error rather
  // than a constraint violation.
  if (await repository.findLive(email, workspaceId)) {
    throw new AppError(
      httpStatus.CONFLICT,
      'An invitation is already pending for that address',
      AUTH_CODES.INVITE_PENDING
    );
  }

  const token = mintOpaqueToken();

  const invitation = await repository.create({
    email,
    workspaceId,
    role,
    roleId: custom?.id ?? null,
    invitedById,
    tokenHash: hashToken(token),
    expiresAt: expiryFromNow(),
  });

  // The RAW token goes into the job payload. Only the hash is stored, so the
  // worker cannot rebuild the link from the row no matter what it reads back
  // (§7.5) — this is the one moment the raw value can be handed on.
  await enqueueInvitationEmail({ invitationId: invitation.id, token });

  const withInviter = await prisma.invitation.findUnique({
    where: { id: invitation.id },
    include: { invitedBy: true, customRole: { select: { name: true } } },
  });

  return { invitation: dto.toInvitation(withInviter) };
};

const listInvitations = async ({ workspaceId }) => {
  const rows = await repository.listPending(workspaceId);

  return { invitations: rows.map(dto.toInvitation) };
};

/**
 * Cancels an invitation.
 *
 * Sets `revokedAt`; the row stays. The HTTP verb describes what the admin does
 * to the invitation, not what happens to the row — deleting it would destroy the
 * audit trail, which is the reason the terminal states are timestamps (§3.6).
 */
const revokeInvitation = async ({ workspaceId, id }) => {
  const invitation = await repository.findById(id);

  // Scoped to the workspace in the path: an id from another workspace must look
  // like a missing one, not like a permission error, or the endpoint confirms
  // that some other workspace holds that invitation.
  if (!invitation || invitation.workspaceId !== workspaceId) throw notFound();

  if (dto.statusOf(invitation) !== dto.STATUS.PENDING) throw notFound();

  await repository.update(id, { revokedAt: new Date() });
};

/**
 * Re-sends an invitation, **rotating the token**.
 *
 * The old link stops working. Re-using the token would mean a link the admin
 * believes they replaced still grants access — and "resend" is exactly what an
 * admin does when they suspect the first link went astray.
 */
const resendInvitation = async ({ workspaceId, id }) => {
  const invitation = await repository.findById(id);

  if (!invitation || invitation.workspaceId !== workspaceId) throw notFound();
  if (dto.statusOf(invitation) !== dto.STATUS.PENDING) throw notFound();

  const token = mintOpaqueToken();

  const updated = await repository.update(id, {
    tokenHash: hashToken(token),
    expiresAt: expiryFromNow(),
  });

  await enqueueInvitationEmail({ invitationId: updated.id, token });

  const withInviter = await prisma.invitation.findUnique({
    where: { id },
    include: { invitedBy: true },
  });

  return { invitation: dto.toInvitation(withInviter) };
};

/* ── Recipient side (sprint 8) ──────────────────────────────────────────── */

/**
 * Public lookup by raw token — the only unauthenticated route outside `auth`,
 * and unauthenticated by necessity: the recipient has no account yet.
 *
 * Expired answers `410` because that is a recoverable state the UI can explain
 * ("ask for a new invitation"); every other dead state collapses to `404`. See
 * rule 1 in the file header.
 */
const lookupInvitation = async ({ token }) => {
  const invitation = await repository.findByTokenHash(hashToken(token));

  if (!invitation) throw notFound();

  const status = dto.statusOf(invitation);

  if (status === dto.STATUS.EXPIRED) {
    throw new AppError(httpStatus.GONE, 'This invitation has expired', AUTH_CODES.TOKEN_EXPIRED);
  }

  if (status !== dto.STATUS.PENDING) throw notFound();

  return { invitation: dto.toPublicInvitation(invitation, token) };
};

/**
 * Enforces the email binding (§6.2).
 *
 * The signed-in account's address must equal the invitation's. Without it,
 * anyone who obtains a link joins the workspace as themselves — the token would
 * be a bearer credential for membership rather than a message to one person.
 *
 * The mismatch error names the address to sign in as, which is safe: whoever
 * holds the token was already told that address by the email that carried it.
 */
const assertEmailBinding = (invitation, user) => {
  if (invitation.email !== user.email) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `This invitation was sent to ${invitation.email}. Sign in as that address to accept.`,
      AUTH_CODES.INVITE_EMAIL_MISMATCH
    );
  }
};

/**
 * Accepts an invitation.
 *
 * The row is locked `FOR UPDATE` inside the transaction and its state re-read
 * afterwards. Without the lock, an accept racing a revoke can both read the row
 * as pending and both succeed: the admin sees the invitation cancelled and the
 * recipient is a member anyway.
 */
const acceptInvitation = async ({ token, userId }) => {
  const invitation = await repository.findByTokenHash(hashToken(token));

  if (!invitation) throw notFound();

  const user = await authRepository.findUserById(userId);
  if (!user) throw notFound();

  assertEmailBinding(invitation, user);

  // Already a member — return the membership, do not fail. A double-clicked
  // Accept must not report failure for something that succeeded (§6.5).
  const existing = await repository.findMembership(userId, invitation.workspaceId);
  if (existing) {
    return { membership: existing, alreadyMember: true };
  }

  return prisma.$transaction(async (tx) => {
    await repository.lockByIdForUpdate(invitation.id, tx);

    // Re-read under the lock. The state may have changed between the unlocked
    // read above and acquiring it — that is the whole race this closes.
    const locked = await repository.findById(invitation.id, tx);
    const status = dto.statusOf(locked);

    if (status === dto.STATUS.EXPIRED) {
      throw new AppError(httpStatus.GONE, 'This invitation has expired', AUTH_CODES.TOKEN_EXPIRED);
    }

    if (status !== dto.STATUS.PENDING) {
      // Another request accepted it while we waited. If that request was this
      // same user, the desired end state holds — return it rather than erroring.
      const raced = await repository.findMembership(userId, locked.workspaceId, tx);
      if (raced) return { membership: raced, alreadyMember: true };

      throw notFound();
    }

    // The token was delivered to this address and came back, which is exactly
    // what a verification email proves — so an unverified account accepting a
    // matching invitation becomes verified. This is the deadlock fix's other
    // half (§6.3): without it the new member is signed in but blocked.
    if (!user.emailVerifiedAt) {
      await authRepository.updateUser(userId, { emailVerifiedAt: new Date() }, tx);
    }

    const membership = await repository.createMembership(
      { userId, workspaceId: locked.workspaceId, role: locked.role, roleId: locked.roleId ?? null },
      tx
    );

    await repository.update(
      locked.id,
      { acceptedAt: new Date(), acceptedById: userId },
      tx
    );

    return { membership, alreadyMember: false };
  });
};

/** Declines an invitation. Same email binding — only the addressee may refuse. */
const declineInvitation = async ({ token, userId }) => {
  const invitation = await repository.findByTokenHash(hashToken(token));

  if (!invitation) throw notFound();

  const user = await authRepository.findUserById(userId);
  if (!user) throw notFound();

  assertEmailBinding(invitation, user);

  if (dto.statusOf(invitation) !== dto.STATUS.PENDING) throw notFound();

  await repository.update(invitation.id, { declinedAt: new Date() });
};

/**
 * Applies an `inviteToken` during registration — **the deadlock fix** (§6.4).
 *
 * Without it the invite path cannot complete:
 *
 * ```
 * register → emailVerifiedAt null, no session
 *    → login → 403 EMAIL_NOT_VERIFIED
 *       → cannot reach the accept screen
 *          → waiting on a verification email that never arrives
 * ```
 *
 * Neither half is wrong alone; they are only wrong together, on this path.
 *
 * **Returns false rather than throwing on any failure.** A bad, expired or
 * mismatched token must not fail the registration — losing an account because an
 * invitation expired mid-signup is a worse outcome than an extra click. The
 * caller creates the account normally and reports `inviteApplied: false`.
 */
const applyInviteTokenOnRegister = async ({ token, user }, tx) => {
  try {
    const invitation = await repository.findByTokenHash(hashToken(token), tx);

    if (!invitation) return false;
    if (dto.statusOf(invitation) !== dto.STATUS.PENDING) return false;
    // Same binding as accept: an invitation is addressed to one person.
    if (invitation.email !== user.email) return false;

    await repository.createMembership(
      { userId: user.id, workspaceId: invitation.workspaceId, role: invitation.role, roleId: invitation.roleId ?? null },
      tx
    );

    await repository.update(
      invitation.id,
      { acceptedAt: new Date(), acceptedById: user.id },
      tx
    );

    return true;
  } catch {
    // Deliberately swallowed. Anything unexpected here means the invitation was
    // not applied — it must never mean the account was not created.
    return false;
  }
};

/**
 * Answers whether a raw token is a live invitation addressed to `email` —
 * **the deadlock fix's other half**, for an account that already exists.
 *
 * `applyInviteTokenOnRegister` above covers the recipient with no account. It
 * cannot help one who registered first and never verified, because `register`
 * refuses a taken address long before a token is looked at:
 *
 * ```
 * account exists, emailVerifiedAt null
 *    → login → 403 EMAIL_NOT_VERIFIED
 *       → cannot reach the accept screen, which is the one thing that
 *         would have verified them (§6.3)
 *          → waiting on a verification email sent before the invitation
 * ```
 *
 * A token that was mailed to an address and came back proves that address —
 * the same claim `acceptInvitation` and `verifyLoginCodeAndSignIn` already act
 * on. This function makes that claim available to `login` without granting
 * anything else: it reads, it does not accept the invitation, create a
 * membership or write a session. The caller decides what the proof is worth.
 *
 * **Returns false rather than throwing**, on every failure including an
 * unexpected one, so a bad token can only ever leave the caller's own rules in
 * force — never turn a wrong password into a different error.
 */
const tokenProvesEmail = async ({ token, email }) => {
  try {
    const invitation = await repository.findByTokenHash(hashToken(token));

    if (!invitation) return false;
    if (dto.statusOf(invitation) !== dto.STATUS.PENDING) return false;

    return invitation.email === email;
  } catch {
    return false;
  }
};

export default {
  createInvitation,
  listInvitations,
  revokeInvitation,
  resendInvitation,
  lookupInvitation,
  acceptInvitation,
  declineInvitation,
  applyInviteTokenOnRegister,
  tokenProvesEmail,
};
