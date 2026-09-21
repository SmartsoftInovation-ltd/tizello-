/**
 * Joi schemas for the member module — request shape only. Authorization is
 * middleware (`requirePermission`), and the state rules that decide *who* may be
 * acted on live in the service; neither belongs here.
 *
 * The `role` restriction is the one rule that is more than shape, and it is
 * duplicated in the service on purpose — the same call
 * `invitation.validator.js` makes, for the same reason. An endpoint that can
 * mint an OWNER is a privilege-escalation endpoint, and a validator only
 * protects callers that arrive over HTTP: the service is reachable from a
 * worker, a script, or another service.
 *
 * See docs/api/member.md §2 and .claude/plan/member.md §2.3
 */

import Joi from 'joi';
import { ROLES } from '../../shared/constants/roles.js';

// OWNER is ABSENT from the list rather than rejected by a rule — a closed list
// cannot be widened by a typo, and ownership is transferred, never granted.
/* One of the two, never neither. `roleId` names a workspace-defined role and
   carries its own rung; `role` sets the tier directly and clears any custom
   role. `.xor` rather than two optionals so "change this member to nothing"
   cannot be expressed — an empty body would otherwise be a silent no-op that
   answers 200. */
const updateRoleSchema = Joi.object({
  role: Joi.string().valid(ROLES.ADMIN, ROLES.MEMBER),
  roleId: Joi.string().max(64),
}).xor('role', 'roleId');

/**
 * `.unknown(true)` because this router runs with `mergeParams: true`: the
 * parent mount contributes `workspaceId`, and a strict schema would reject any
 * param a future nested route adds.
 */
const memberParamsSchema = Joi.object({
  workspaceId: Joi.string().max(64).required(),
  memberId: Joi.string().max(64).required(),
}).unknown(true);

const workspaceParamsSchema = Joi.object({
  workspaceId: Joi.string().max(64).required(),
}).unknown(true);

export { updateRoleSchema, memberParamsSchema, workspaceParamsSchema };
