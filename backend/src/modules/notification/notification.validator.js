/**
 * Joi schemas for the notification module — request shape only. There is no
 * authorization rule here to duplicate: a notification belongs to exactly one
 * user, and every query below is scoped to `req.user.id` in the repository, so
 * there is nothing a validator could usefully guard.
 *
 * See docs/api/notification.md
 */

import Joi from 'joi';

/* 50 is the ceiling rather than the default. The bell shows a dozen; a client
   asking for 500 is one that means to page, and paging is `before`. */
const listQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).default(20),
  // Cursor, not offset: new notifications arrive at the head constantly, and
  // an offset page-2 would skip whatever landed since page 1 was drawn.
  before: Joi.string().isoDate(),
  unreadOnly: Joi.boolean().default(false),
});

const notificationParamsSchema = Joi.object({
  notificationId: Joi.string().max(64).required(),
}).unknown(true);

export { listQuerySchema, notificationParamsSchema };
