/**
 * Joi schemas for the trash module — request SHAPE only. Whether the row is
 * actually deleted, and whether this caller may act on it, both need the row,
 * so both are the service's.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/trash.md
 */

import Joi from 'joi';

const trashQuerySchema = Joi.object({
  /* Per KIND, like the search module's: fifty projects and fifty tasks, so a
     week of deleted tasks can never push the one project you are looking for
     off the list. */
  limit: Joi.number().integer().min(1).max(100).default(50),
});

/* A cuid, loosely: enough to reject a path segment that is obviously not an
   id before it reaches the database, not enough to claim the row exists. */
const idParamSchema = Joi.object({
  id: Joi.string().trim().min(1).max(60).required(),
});

export { trashQuerySchema, idParamSchema };
