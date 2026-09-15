/**
 * Joi schemas for the sprint module — request SHAPE only. Whether another
 * sprint is already active, whether the sprint's state allows the operation,
 * whether an end date falls after a start date that is only on the stored row:
 * all of those need the row, so all of them are the service's.
 *
 * `state` appears in no write schema. A sprint changes state only through
 * `/start` and `/complete`, which carry the side effects a bare PATCH of the
 * column would skip — returning unfinished work, stamping `startedAt`.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/sprint.md
 */

import Joi from 'joi';

import { SPRINT_STATES } from '../../shared/constants/sprint.js';

const name = Joi.string().trim().min(1).max(80);
const goal = Joi.string().trim().max(500).allow(null, '');
// Calendar days, `YYYY-MM-DD` — see the DTO for why not timestamps.
const date = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .allow(null)
  .messages({ 'string.pattern.base': 'Use a YYYY-MM-DD date' });
// A forecast in points; null clears it. 1000 is far past any team's sprint.
const capacityPoints = Joi.number().integer().min(0).max(1000).allow(null);

/* `name` is optional: omitted, the service names it "<KEY> Sprint <n>", which
   is what "Create sprint" in a backlog should do in one click. */
const createSprintSchema = Joi.object({
  name: name.optional(),
  goal: goal.optional(),
  startDate: date.optional(),
  endDate: date.optional(),
  capacityPoints: capacityPoints.optional(),
});

const updateSprintSchema = Joi.object({
  name: name.optional(),
  goal: goal.optional(),
  startDate: date.optional(),
  endDate: date.optional(),
  capacityPoints: capacityPoints.optional(),
})
  .min(1)
  .messages({ 'object.min': 'Provide at least one field to update' });

/* Starting may set the last details in the same request — the start dialog is
   where dates and a goal are usually decided. */
const startSprintSchema = Joi.object({
  name: name.optional(),
  goal: goal.optional(),
  startDate: date.optional(),
  endDate: date.optional(),
});

const listSprintsQuerySchema = Joi.object({
  state: Joi.string()
    .valid(...Object.values(SPRINT_STATES))
    .optional(),
});

export { createSprintSchema, updateSprintSchema, startSprintSchema, listSprintsQuerySchema };
