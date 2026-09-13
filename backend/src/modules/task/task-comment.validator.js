/**
 * Joi schema for task comments — request shape only.
 *
 * There is no update schema, and no PATCH endpoint: a comment thread is a
 * record of what was said, and an edit that rewrites history without showing
 * it was edited is worse than no edit. Delete-and-repost is the escape hatch
 * until an "edited" marker is designed (docs/api/task.md §Open questions).
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/task.md
 */

import Joi from 'joi';

const createCommentSchema = Joi.object({
  body: Joi.string().trim().min(1).max(5000).required(),
});

export { createCommentSchema };
