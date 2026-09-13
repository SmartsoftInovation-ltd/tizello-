/**
 * Joi schemas for task statuses — request shape only. Whether a status belongs
 * to the project, whether it is the default, whether a reorder names every
 * status: those need the stored rows and are the service's.
 *
 * `group` is in create and in the ORDER body, never in PATCH. Moving a status
 * between groups is a drag in the editor, and a drag reorders the whole list;
 * accepting a group on PATCH would give one change two endpoints that position
 * it differently.
 *
 * `isDefault` accepts only `true`. "Not the default" is not something a status
 * can become on its own — some other status has to take the role — so `false`
 * would describe a request that cannot be honoured.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/task.md §Statuses
 */

import Joi from 'joi';

import { STATUS_COLORS, STATUS_GROUPS } from '../../shared/constants/taskStatus.js';

const name = Joi.string().trim().min(1).max(40);
const color = Joi.string().valid(...STATUS_COLORS);
const group = Joi.string().valid(...STATUS_GROUPS);

const createTaskStatusSchema = Joi.object({
  name: name.required(),
  color: color.default('gray'),
  group: group.required(),
});

const updateTaskStatusSchema = Joi.object({
  name: name.optional(),
  color: color.optional(),
  isDefault: Joi.boolean().valid(true).optional(),
})
  .min(1)
  .messages({ 'object.min': 'Provide at least one field to update' });

const reorderTaskStatusesSchema = Joi.object({
  statuses: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().trim().max(64).required(),
        group: group.required(),
      })
    )
    .min(1)
    .required(),
});

export { createTaskStatusSchema, updateTaskStatusSchema, reorderTaskStatusesSchema };
