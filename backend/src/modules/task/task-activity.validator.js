/**
 * Joi schemas for task activity — request shape only.
 *
 * Nearly empty, and present anyway: the one endpoint is a bare GET with no body
 * and no query, and module-consistency keeps all six files so a later `?since=`
 * or `?field=` filter has an obvious home instead of landing in a controller.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/task.md §Activity
 */

import Joi from 'joi';

// Rejects any query string today — an unknown param is a caller mistake, not a
// filter this endpoint silently ignored.
const listActivityQuerySchema = Joi.object({});

export { listActivityQuerySchema };
