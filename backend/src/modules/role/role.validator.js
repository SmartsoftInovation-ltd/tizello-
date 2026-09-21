/**
 * Joi schemas for the role module — request shape only. Authorization is
 * middleware (`requirePermission(ROLE_MANAGE)`), and the state rules that
 * decide *which* roles may be acted on (built-ins are locked) live in the
 * service; neither belongs here.
 *
 * `baseRole` EXCLUDES OWNER, and that is the security line of this file. A
 * workspace that could mint a role sitting on the OWNER rung could mint one for
 * anybody, and `roleAtLeast(role, OWNER)` gates ownership transfer and
 * workspace deletion. The same restriction is repeated in the service, for the
 * reason `member.validator.js` gives: a validator only protects callers that
 * arrive over HTTP.
 *
 * See docs/api/role.md
 */

import Joi from 'joi';
import { ROLES, ALL_PERMISSIONS } from '../../shared/constants/roles.js';

/* A closed list of known ids, not free strings. An unknown id would be dropped
   by the DTO anyway, but failing loudly tells a client its catalog is stale
   instead of silently saving a role that grants less than it was asked to. */
const permissionList = Joi.array()
  .items(Joi.string().valid(...ALL_PERMISSIONS))
  .unique()
  .max(ALL_PERMISSIONS.length)
  .required();

const createRoleSchema = Joi.object({
  name: Joi.string().trim().min(2).max(40).required(),
  baseRole: Joi.string().valid(ROLES.ADMIN, ROLES.MEMBER).default(ROLES.MEMBER),
  permissions: permissionList,
});

/* Every field optional, but at least one required: a PATCH with an empty body
   is a client bug, and answering 200 to it hides the bug. */
const updateRoleSchema = Joi.object({
  name: Joi.string().trim().min(2).max(40),
  baseRole: Joi.string().valid(ROLES.ADMIN, ROLES.MEMBER),
  permissions: permissionList.optional(),
}).min(1);

/**
 * `.unknown(true)` because this router runs with `mergeParams: true`: the
 * parent mount contributes `workspaceId`, and a strict schema would reject any
 * param a future nested route adds.
 */
const roleParamsSchema = Joi.object({
  workspaceId: Joi.string().max(64).required(),
  roleId: Joi.string().max(64).required(),
}).unknown(true);

const workspaceParamsSchema = Joi.object({
  workspaceId: Joi.string().max(64).required(),
}).unknown(true);

export { createRoleSchema, updateRoleSchema, roleParamsSchema, workspaceParamsSchema };
