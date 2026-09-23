/**
 * Joi schemas for chat — the REST half AND the socket half.
 *
 * **ONE VOCABULARY OF VALID INPUT ACROSS BOTH TRANSPORTS.** The socket
 * handlers in `src/realtime/chat.namespace.js` validate their payloads with
 * the schemas below rather than with checks of their own. A message that is
 * too long over HTTP and accepted over a socket would be a rule enforced on
 * one door of a room with two.
 *
 * **`senderId` AND `userId` ARE `forbidden()`, NOT IGNORED.** The sender is
 * `socket.data.userId`, always — a payload field that is sometimes trusted is
 * a field somebody will eventually trust. Rejecting the field loudly means a
 * client that sends one learns immediately, instead of believing it worked and
 * shipping against a behaviour that was never real. This is the single most
 * important line in the module; see docs/api/chat.md §3.
 *
 * See docs/api/chat.md and .claude/skills/module-consistency/SKILL.md
 */

import Joi from 'joi';

/** 4000 characters. Long enough for a pasted stack trace, short enough that
 *  the column never decides — a cap enforced here produces a readable
 *  per-field error, a cap enforced by Postgres produces a 500. */
const CONTENT_MAX = 4000;

const id = Joi.string().max(64);

/* The two fields no payload may carry, in one place so every schema below
   spreads the same refusal. */
const IDENTITY_IS_NOT_INPUT = {
  senderId: Joi.any().forbidden(),
  userId: Joi.any().forbidden(),
};

const content = Joi.string().trim().min(1).max(CONTENT_MAX).required();

/* --- REST -------------------------------------------------------------- */

const workspaceParamsSchema = Joi.object({
  workspaceId: id.required(),
}).unknown(true);

const historyQuerySchema = Joi.object({
  // 30 is the default and 100 the ceiling: a channel page is drawn into a
  // scroll view, and a client asking for 500 means to page.
  limit: Joi.number().integer().min(1).max(100).default(30),
  // Opaque — see `chat.dto.js#encodeCursor`. Validated as a shape here and as
  // a decodable value in the service, which is the only place that knows the
  // encoding.
  cursor: Joi.string().max(256),
});

const markReadSchema = Joi.object({
  /* Optional: the common case is "I have read everything", which needs no
     argument. `at` exists for catching up to a specific point — a client that
     read to the middle of a page. A future `at` is clamped in the service
     rather than rejected here, because the clock that matters is the
     server's. */
  at: Joi.string().isoDate(),
  ...IDENTITY_IS_NOT_INPUT,
});

/* --- socket payloads --------------------------------------------------- */

/**
 * Every socket payload names the workspace whose channel it means. There is
 * one channel per workspace, so the workspace IS the address — no channel id
 * to hand out, and nothing for a client to hold that could be pointed at a
 * conversation it has no access to.
 *
 * Holding the id would not have been a permission either — the service
 * re-checks membership on every event — but an address a client cannot mistype
 * into somebody else's room is better than one it can.
 */
const channelPayloadSchema = Joi.object({
  workspaceId: id.required(),
  ...IDENTITY_IS_NOT_INPUT,
});

const sendMessageSchema = Joi.object({
  workspaceId: id.required(),
  content,
  /* An opaque string the sender generates and the broadcast echoes, so the
     sender's client can reconcile its optimistic bubble with the real row
     instead of rendering the message twice. The server never interprets it and
     never stores it — which is exactly why it is length-capped: an
     uninterpreted value that is written back out is otherwise free
     amplification. */
  clientId: Joi.string().max(64),
  ...IDENTITY_IS_NOT_INPUT,
});

const editMessageSchema = Joi.object({
  messageId: id.required(),
  content,
  ...IDENTITY_IS_NOT_INPUT,
});

const deleteMessageSchema = Joi.object({
  messageId: id.required(),
  ...IDENTITY_IS_NOT_INPUT,
});

export {
  CONTENT_MAX,
  workspaceParamsSchema,
  historyQuerySchema,
  markReadSchema,
  channelPayloadSchema,
  sendMessageSchema,
  editMessageSchema,
  deleteMessageSchema,
};
