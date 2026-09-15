/**
 * Joi schema for task comments — request shape only.
 *
 * Edits are allowed, and always visible: an edit stamps `editedAt`, which the
 * client renders as "edited". A thread is a record of what was said, and an
 * edit that silently rewrote it would be worse than no edit at all.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/task.md
 */

import Joi from 'joi';

const body = Joi.string().trim().min(1).max(5000).required();

const createCommentSchema = Joi.object({ body });

// Same rule as create: only the body is editable. Author and timestamps are facts.
const updateCommentSchema = Joi.object({ body });

export { createCommentSchema, updateCommentSchema };
