/**
 * HTTP edge of the invitation module. Reads `req`, calls the service, sends
 * through `ApiResponse`. No business rules, no Prisma.
 *
 * See .claude/skills/api-response/SKILL.md and docs/api/invitation.md
 */

import ApiResponse from '../../shared/utils/apiResponse.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import service from './invitation.service.js';

const create = async (req, res) => {
  const result = await service.createInvitation({
    workspaceId: req.params.workspaceId,
    email: req.body.email,
    role: req.body.role,
    roleId: req.body.roleId ?? null,
    invitedById: req.user.id,
    inviterMembership: req.membership,
  });

  return ApiResponse.success(res, httpStatus.CREATED, 'Invitation sent', result);
};

const list = async (req, res) => {
  const result = await service.listInvitations({ workspaceId: req.params.workspaceId });

  return ApiResponse.success(res, httpStatus.OK, 'Pending invitations', result);
};

/**
 * `204` with no body — the row still exists with `revokedAt` set, but the
 * client's model of it is simply "gone", and returning the tombstone would
 * invite a caller to render it.
 */
const revoke = async (req, res) => {
  await service.revokeInvitation({ workspaceId: req.params.workspaceId, id: req.params.id });

  return res.status(httpStatus.NO_CONTENT).end();
};

const resend = async (req, res) => {
  const result = await service.resendInvitation({
    workspaceId: req.params.workspaceId,
    id: req.params.id,
  });

  return ApiResponse.success(res, httpStatus.OK, 'Invitation resent', result);
};

const lookup = async (req, res) => {
  const result = await service.lookupInvitation({ token: req.params.token });

  return ApiResponse.success(res, httpStatus.OK, 'Invitation', result);
};

/**
 * `200` on both the first accept and every repeat, with `alreadyMember` saying
 * which happened. The status does not change, because from the client's point of
 * view nothing did: they are in the workspace either way.
 */
const accept = async (req, res) => {
  const { membership, alreadyMember } = await service.acceptInvitation({
    token: req.params.token,
    userId: req.user.id,
  });

  return ApiResponse.success(res, httpStatus.OK, 'Invitation accepted', {
    workspaceId: membership.workspaceId,
    role: membership.role,
    alreadyMember,
  });
};

const decline = async (req, res) => {
  await service.declineInvitation({ token: req.params.token, userId: req.user.id });

  return res.status(httpStatus.NO_CONTENT).end();
};

export default { create, list, revoke, resend, lookup, accept, decline };
