/**
 * Joi schema for the search module — request SHAPE only. What the term MEANS
 * (a task key, a word, a prefix) is the service's: it needs no request context
 * and every layer below would otherwise have to re-derive it.
 *
 * `q` IS REQUIRED AND AT LEAST TWO CHARACTERS. A one-character `contains` over
 * three tables matches most of the database and returns the rows that happen
 * to have been updated last, which is noise dressed as an answer — and it is
 * the cheapest query for a client to send in a loop. The floor is a
 * correctness rule first and a cost rule second; the client keeps its own
 * copy of it so the field simply stays quiet until it is worth asking.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/search.md
 */

import Joi from 'joi';

const searchQuerySchema = Joi.object({
  q: Joi.string().trim().min(2).max(100).required().messages({
    'string.min': 'Type at least 2 characters to search',
    'any.required': 'What are you looking for?',
  }),
  /* Per TYPE, not in total: five tasks and five projects, so one crowded
     category can never starve another out of the palette. 20 is the ceiling
     because past it the reader is scrolling a list rather than reading a
     shortlist, and should narrow the term instead. */
  limit: Joi.number().integer().min(1).max(20).default(5),
});

export { searchQuerySchema };
