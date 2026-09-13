/**
 * Joi schemas for TASK property definitions — request shape only.
 *
 * The rules are the project-property ones, re-exported rather than copied: a
 * task column and a project column are the same kind of thing (a name, an
 * immutable type, options for the two select types), and two copies of
 * "options belong to Select and Multi-select only" is two places for that rule
 * to drift. What differs between the modules is the SCOPE a definition belongs
 * to — a project here, a workspace there — which is the routes' and the
 * repository's business, not the request's.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/task.md
 */

import {
  createPropertySchema as createTaskPropertySchema,
  updatePropertySchema as updateTaskPropertySchema,
} from '../project/project-property.validator.js';

export { createTaskPropertySchema, updateTaskPropertySchema };
