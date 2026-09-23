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

/** 10 MB, matching the upload endpoint's own cap (`docs/api/upload.md`). */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/* At most five per message: the composer uploads them one at a time and the
   thread renders them in a row, and a message carrying thirty files is a
   folder, which this is not. */
const MAX_ATTACHMENTS = 5;

/**
 * ONE ATTACHMENT, AS `POST /uploads` DESCRIBED IT.
 *
 * **These fields are echoed by the client, so they are shape-checked and not
 * believed.** `storedName` is the only one that reaches the filesystem, and it
 * is the one the download route re-validates before serving anything; `name`,
 * `mime` and `size` are display values, and the worst a lie about them does is
 * mislabel a file in a bubble. The alternative — re-reading each upload from
 * disk on every send — would put a stat call per file on the hot path to
 * re-derive what the server itself returned seconds earlier.
 */
const attachment = Joi.object({
  id: Joi.string().max(128).required(),
  name: Joi.string().max(255).required(),
  /* `<uuid>.<ext>`, which is what the upload service generates. Anything with
     a slash or a `..` in it is refused here rather than at the filesystem. */
  storedName: Joi.string()
    .max(255)
    .pattern(/^[A-Za-z0-9._-]+$/)
    .required(),
  url: Joi.string().max(512).required(),
  size: Joi.number().integer().min(0).max(MAX_ATTACHMENT_BYTES).required(),
  mime: Joi.string().max(128).required(),
});

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

/* A message needs SOMETHING: text, files, or both. Empty content with no
   attachments is not a message, and the check has to be at the object level
   because neither field alone can see the other. */
const notEmpty = (value, helpers) =>
  value.content?.trim() || value.attachments?.length ? value : helpers.error('any.custom');

const sendMessageSchema = Joi.object({
  workspaceId: id.required(),
  /* Optional HERE, unlike an edit: a message that is only a photo is a normal
     thing to send, and a message edited down to nothing is not. */
  content: Joi.string().trim().max(CONTENT_MAX).allow('').default(''),
  attachments: Joi.array().items(attachment).max(MAX_ATTACHMENTS).default([]),
  /* An opaque string the sender generates and the broadcast echoes, so the
     sender's client can reconcile its optimistic bubble with the real row
     instead of rendering the message twice. The server never interprets it and
     never stores it — which is exactly why it is length-capped: an
     uninterpreted value that is written back out is otherwise free
     amplification. */
  clientId: Joi.string().max(64),
  ...IDENTITY_IS_NOT_INPUT,
})
  .custom(notEmpty)
  .messages({ 'any.custom': 'A message needs text or a file' });

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
  MAX_ATTACHMENTS,
  workspaceParamsSchema,
  historyQuerySchema,
  markReadSchema,
  channelPayloadSchema,
  sendMessageSchema,
  editMessageSchema,
  deleteMessageSchema,
};
