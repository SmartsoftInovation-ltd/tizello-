/**
 * Joi schemas for the invitation module — request shape only.
 *
 * The `role` restriction is the one rule here that is more than shape, and it is
 * duplicated in the service on purpose. An endpoint that can mint an OWNER is a
 * privilege-escalation endpoint; one layer of defence is not enough for that,
 * and a validator can be bypassed by any future caller that reaches the service
 * directly (a worker, a script, another service).
 *
 * `frontend/src/types/workspace.ts`: *"Ownership is transferred, never granted
 * by invitation."*
 *
 * See docs/api/invitation.md and .claude/specs/auth/auth.sprint7.md §7.2
 */

import Joi from 'joi';
import { ROLES } from '../../shared/constants/roles.js';

const createInvitationSchema = Joi.object({
  email: Joi.string().trim().lowercase().email({ tlds: false }).max(254).required(),
  // OWNER is absent by construction rather than rejected by a rule — a closed
  // list cannot be widened by a typo.
  role: Joi.string().valid(ROLES.ADMIN, ROLES.MEMBER).default(ROLES.MEMBER),
  // A workspace-defined role to join with. When present its `baseRole` sets
  // the rung and `role` is ignored — see invitation.service.js.
  roleId: Joi.string().max(64).allow(null).optional(),
});

const workspaceParamsSchema = Joi.object({
  workspaceId: Joi.string().max(64).required(),
}).unknown(true);

const invitationParamsSchema = Joi.object({
  workspaceId: Joi.string().max(64).required(),
  id: Joi.string().max(64).required(),
}).unknown(true);

const tokenParamsSchema = Joi.object({
  token: Joi.string().max(200).required(),
}).unknown(true);

export {
  createInvitationSchema,
  workspaceParamsSchema,
  invitationParamsSchema,
  tokenParamsSchema,
};
