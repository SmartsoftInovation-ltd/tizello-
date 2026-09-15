/**
 * Every Prisma call the auth module makes. No business rules live here — the
 * service decides *whether* to revoke a family; this file only knows *how*.
 *
 * Two conventions worth stating, because breaking either is silent:
 *
 * 1. **Lookups are by hash, never by raw token.** Callers hash first
 *    (`hashToken` / `bcrypt`) and pass the digest. Nothing in this file ever
 *    receives a raw credential, so nothing here can accidentally log one.
 * 2. **Transactional work takes a `tx`.** The rotation and accept flows must be
 *    atomic, so the functions they use accept a Prisma transaction client and
 *    default to the singleton. Calling one without a `tx` inside a
 *    `$transaction` silently runs it on a *different* connection, outside the
 *    transaction — the one bug in this file that no test shape catches.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/auth.md
 */

import prisma from '../../config/db.js';

/* ── Users ─────────────────────────────────────────────────────────────── */

// Email is stored normalized (lowercased, trimmed) by the validator, so this
// is a plain equality match rather than a case-insensitive scan — the unique
// index does the work.
const findUserByEmail = (email, tx = prisma) => tx.user.findUnique({ where: { email } });

const findUserById = (id, tx = prisma) => tx.user.findUnique({ where: { id } });

const createUser = (data, tx = prisma) => tx.user.create({ data });

const updateUser = (id, data, tx = prisma) => tx.user.update({ where: { id }, data });

/* ── Verification tokens (email verify + password reset) ───────────────── */

const createVerificationToken = (data, tx = prisma) => tx.verificationToken.create({ data });

// Always narrowed by `purpose` as well as by hash. The hash alone is unique, so
// this looks redundant — it is not: it is what stops a token minted to verify
// an address from being redeemable at the password-reset endpoint. The filter
// belongs here rather than in a caller's `if`, so no future caller can forget.
const findVerificationToken = (tokenHash, purpose, tx = prisma) =>
  tx.verificationToken.findFirst({ where: { tokenHash, purpose }, include: { user: true } });

const consumeVerificationToken = (id, tx = prisma) =>
  tx.verificationToken.update({ where: { id }, data: { consumedAt: new Date() } });

// Invalidates every outstanding token of one purpose for a user, so a resend
// leaves exactly one live link. Without it, an old link keeps working after the
// user has asked for a new one, which is a longer window than intended.
const consumeOutstandingVerificationTokens = (userId, purpose, tx = prisma) =>
  tx.verificationToken.updateMany({
    where: { userId, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

/* ── Refresh tokens ────────────────────────────────────────────────────── */

const createRefreshToken = (data, tx = prisma) => tx.refreshToken.create({ data });

const findRefreshTokenByHash = (tokenHash, tx = prisma) =>
  tx.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });

const findRefreshTokenById = (id, tx = prisma) => tx.refreshToken.findUnique({ where: { id } });

// Claims a token for rotation: revokes it ONLY if it is still live, and returns
// how many rows that was (1 or 0). A conditional UPDATE is what makes rotation
// atomic — two concurrent refreshes with the same token both read it as live,
// but Postgres re-checks `revokedAt IS NULL` for the second UPDATE after the
// first commits, so exactly one of them wins. Read-then-update let both win and
// mint two successors from one token.
const claimRefreshToken = async (id, tx = prisma) =>
  (await tx.refreshToken.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } })).count;

// Points a claimed token at the successor it was rotated into.
const setRefreshTokenSuccessor = (id, replacedById, tx = prisma) =>
  tx.refreshToken.update({ where: { id }, data: { replacedById } });

// Revokes a whole lineage. `revokedAt: null` in the filter keeps an already
// revoked row's original timestamp — the moment a token was first revoked is
// the forensic detail, and a blanket update would overwrite it with the moment
// of the reuse that was detected later.
const revokeRefreshTokenFamily = (familyId, tx = prisma) =>
  tx.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

// Password reset kills every session, not just the current family (spec §9):
// a reset that leaves the attacker's session alive has accomplished nothing.
const revokeAllUserRefreshTokens = (userId, tx = prisma) =>
  tx.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

/* ── Login codes ───────────────────────────────────────────────────────── */

const createLoginCode = (data, tx = prisma) => tx.loginCode.create({ data });

// The newest unconsumed, unexpired code for a user. `orderBy` is load-bearing:
// a user who requested twice in quick succession has two rows, and only the
// latest one was actually delivered to them.
const findLatestLoginCode = (userId, tx = prisma) =>
  tx.loginCode.findFirst({
    where: { userId, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

const incrementLoginCodeAttempts = (id, tx = prisma) =>
  tx.loginCode.update({ where: { id }, data: { attempts: { increment: 1 } } });

const consumeLoginCode = (id, tx = prisma) =>
  tx.loginCode.update({ where: { id }, data: { consumedAt: new Date() } });

// A new request invalidates the old code (spec §9). Done as part of issuing,
// not lazily at verify time, so there is never a window with two live codes.
const consumeOutstandingLoginCodes = (userId, tx = prisma) =>
  tx.loginCode.updateMany({
    where: { userId, consumedAt: null },
    data: { consumedAt: new Date() },
  });

/* ── Registration codes ────────────────────────────────────────────────── */

const createRegistrationCode = (data, tx = prisma) => tx.registrationCode.create({ data });

// The newest unconsumed, unexpired code for a user. `orderBy` is load-bearing:
// a user who requested twice in quick succession has two rows, and only the
// latest one was actually delivered to them.
const findLatestRegistrationCode = (userId, tx = prisma) =>
  tx.registrationCode.findFirst({
    where: { userId, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

const incrementRegistrationCodeAttempts = (id, tx = prisma) =>
  tx.registrationCode.update({ where: { id }, data: { attempts: { increment: 1 } } });

const consumeRegistrationCode = (id, tx = prisma) =>
  tx.registrationCode.update({ where: { id }, data: { consumedAt: new Date() } });

// A new request invalidates the old code. Done as part of issuing, not lazily
// at verify time, so there is never a window with two live codes.
const consumeOutstandingRegistrationCodes = (userId, tx = prisma) =>
  tx.registrationCode.updateMany({
    where: { userId, consumedAt: null },
    data: { consumedAt: new Date() },
  });

/* ── OAuth accounts (sprint 5) ─────────────────────────────────────────── */

const findOAuthAccount = (provider, providerAccountId, tx = prisma) =>
  tx.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    include: { user: true },
  });

const createOAuthAccount = (data, tx = prisma) => tx.oAuthAccount.create({ data });

export default {
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  createVerificationToken,
  findVerificationToken,
  consumeVerificationToken,
  consumeOutstandingVerificationTokens,
  createRefreshToken,
  findRefreshTokenByHash,
  findRefreshTokenById,
  revokeRefreshTokenFamily,
  claimRefreshToken,
  setRefreshTokenSuccessor,
  revokeAllUserRefreshTokens,
  createLoginCode,
  findLatestLoginCode,
  incrementLoginCodeAttempts,
  consumeLoginCode,
  consumeOutstandingLoginCodes,
  createRegistrationCode,
  findLatestRegistrationCode,
  incrementRegistrationCodeAttempts,
  consumeRegistrationCode,
  consumeOutstandingRegistrationCodes,
  findOAuthAccount,
  createOAuthAccount,
};
