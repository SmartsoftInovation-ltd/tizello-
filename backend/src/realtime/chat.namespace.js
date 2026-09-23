/**
 * The `/chat` namespace: per-project channels, live.
 *
 * **THIS FILE IS A TRANSPORT.** It parses a payload, resolves the caller's
 * access, calls `chat.service`, and emits what comes back. It holds no
 * permission rule and no database call of its own — a handler with an
 * `if (role === …)` in it would be a second answer to a question
 * `shared/services/project-access.js` already answers, and the first time the
 * two disagree, a channel is readable by somebody the REST API refuses.
 *
 * **PERSIST, THEN BROADCAST.** Every write below awaits the service and emits
 * afterwards. A broadcast-first design is faster and wrong: a failed insert
 * leaves a message on every screen in the room that no history load will ever
 * return, and the only way to notice is to reload.
 *
 * **THE SENDER IS `socket.data.userId`. ALWAYS.** No handler reads an identity
 * from a payload; the schemas in `chat.validator.js` reject `senderId` and
 * `userId` outright so a client cannot even believe it worked.
 *
 * Events, and who may emit them, are the contract in docs/api/chat.md §3.
 * Nothing here is a second source of truth for that table.
 *
 * See .claude/plan/chat.md and .claude/specs/chat/chat.sprint3.md
 */

import service from '../modules/chat/chat.service.js';
import repository from '../modules/chat/chat.repository.js';
import {
  channelPayloadSchema,
  deleteMessageSchema,
  editMessageSchema,
  joinChannelSchema,
  sendMessageSchema,
} from '../modules/chat/chat.validator.js';
import AppError from '../shared/utils/AppError.js';
import httpStatus from '../shared/constants/httpStatus.js';
import { AUTH_CODES } from '../shared/constants/authCodes.js';
import { createLogger } from '../config/logger.js';
import { disconnectAtExpiry, handshakeAuth } from './auth.js';
import { channelRoom } from './rooms.js';

const log = createLogger('chat-socket');

/* A client that crashes mid-keystroke must not leave "Alice is typing" on
   screen forever, so the server stops it on the client's behalf. Slightly
   longer than a pause between words and far shorter than a coffee break. */
const TYPING_TIMEOUT_MS = 6000;

/* Per-connection token buckets. `apiLimiter` never runs here — these are not
   HTTP requests and never reach Express middleware — so the limit this module
   needs is one it has to invent. Without it, one script with a valid cookie
   writes to Postgres as fast as the socket accepts and every other member's
   browser renders the result.

   Over the bucket is an error event, never a disconnect: a burst is far more
   often a fast typist than an attack. */
const BUCKETS = {
  message: { capacity: 20, refillMs: 10000 },
  typing: { capacity: 5, refillMs: 10000 },
};

/**
 * Takes one token from a named bucket, refilling it on a sliding window.
 *
 * State lives on `socket.data` and dies with the connection — deliberately not
 * a module-level map keyed by user id, which is a leak with no eviction and
 * would also punish a second tab for the first one's typing.
 */
const takeToken = (socket, name) => {
  const { capacity, refillMs } = BUCKETS[name];
  const buckets = (socket.data.buckets ??= {});
  const now = Date.now();
  const bucket = (buckets[name] ??= { tokens: capacity, at: now });

  if (now - bucket.at >= refillMs) {
    bucket.tokens = capacity;
    bucket.at = now;
  }

  if (bucket.tokens <= 0) return false;

  bucket.tokens -= 1;
  return true;
};

/**
 * `chat:error` — never a thrown exception, never a silent drop.
 *
 * `{ event, code, message }`, where `code` comes from `AUTH_CODES` so a client
 * branches on the same vocabulary as the REST half. A socket has no error
 * middleware, which is why every handler is wrapped rather than trusting a
 * global: an unhandled rejection in a Socket.IO listener is a dropped event
 * with no answer to the caller at all.
 */
const fail = (socket, event, code, message, details) => {
  socket.emit('chat:error', { event, code, message, ...(details ? { details } : {}) });
};

/**
 * Wraps one handler: validate the payload with the module's own schema, run the
 * handler, and turn anything it throws into `chat:error`.
 *
 * An `AppError` carries the code the service chose — the same code the REST
 * half would have returned for the same refusal. Anything else is a bug: it is
 * logged with its stack and answered with `SERVER_ERROR`, because a socket
 * client must not learn a table name any more than an HTTP client may.
 */
const handle = (socket, event, schema, handler) => {
  socket.on(event, async (payload, ack) => {
    const { error, value } = schema.validate(payload ?? {}, { abortEarly: false });

    if (error) {
      return fail(
        socket,
        event,
        AUTH_CODES.VALIDATION_ERROR,
        'Validation failed',
        error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        }))
      );
    }

    try {
      /* The display-name lookup started at connection time. Awaited here
         rather than before `registerHandlers` — see `registerChatNamespace` for
         why nothing may be awaited before the listeners exist — so a handler
         that needs a name has one, and one that does not still costs a single
         already-settled promise. */
      await socket.data.userReady;

      const result = await handler(value, ack);

      /* Ack-style events answer through the callback the client passed, when it
         passed one. A client that does not care still gets the broadcast. */
      if (typeof ack === 'function' && result !== undefined) ack(result);

      return undefined;
    } catch (err) {
      if (err?.isOperational) {
        return fail(socket, event, err.code ?? AUTH_CODES.SERVER_ERROR, err.message, err.details);
      }

      log.error({ err, event, userId: socket.data.userId }, 'Chat socket handler failed');
      return fail(socket, event, AUTH_CODES.SERVER_ERROR, 'Something went wrong');
    }
  });
};

/** Every distinct user in a channel's room, three tabs counted once. */
const presenceOf = async (nsp, channelId) => {
  const sockets = await nsp.in(channelRoom(channelId)).fetchSockets();
  const byUser = new Map();

  for (const member of sockets) {
    const { userId, user } = member.data;

    if (userId && !byUser.has(userId)) byUser.set(userId, user ?? { id: userId, name: null });
  }

  return [...byUser.values()];
};

/** Clears a channel's typing timer, if this socket has one running. */
const clearTyping = (socket, channelId) => {
  const timer = socket.data.typingTimers?.get(channelId);

  if (!timer) return;

  clearTimeout(timer);
  socket.data.typingTimers.delete(channelId);
};

/**
 * Broadcasts a typing state to the room, EXCLUDING the sender: a client that
 * saw its own indicator would render "you are typing" to the person typing.
 */
const broadcastTyping = (socket, channelId, typing) => {
  socket.to(channelRoom(channelId)).emit('typing', {
    channelId,
    userId: socket.data.userId,
    name: socket.data.user?.name ?? null,
    typing,
  });
};

const registerHandlers = (nsp, socket) => {
  socket.data.typingTimers = new Map();
  /* The channels this socket joined, tracked separately from `socket.rooms`
     because `socket.rooms` is already empty by the time `disconnect` fires and
     the remaining members still have to be told who left. */
  socket.data.joinedChannels = new Set();

  /* Membership is proved here and re-proved on every write — see
     `chat.service.js#sendMessage`. Join-only would leave somebody removed from
     a project mid-session broadcasting into it until they refreshed. */
  handle(socket, 'channel:join', joinChannelSchema, async (target) => {
    /* The ONE call that takes a workspace or a project rather than a channel
       id: the client cannot know an id it has never been told, and this is
       where it is told. The access rule per kind lives in the service. */
    const { channel, name } = await service.resolveChannel(socket.data.userId, target);

    await socket.join(channelRoom(channel.id));
    socket.data.joinedChannels.add(channel.id);

    /* Everyone already in the room learns who arrived, and the joiner gets the
       full list — one event shape, two audiences, so a client has one code path
       for "who is here". */
    const users = await presenceOf(nsp, channel.id);

    nsp.to(channelRoom(channel.id)).emit('presence', { channelId: channel.id, users });

    return { channelId: channel.id, kind: channel.kind, name, users };
  });

  /* No permission check: leaving is giving something up, and a socket that may
     not be in a room is a socket that should not stay in it. */
  handle(socket, 'channel:leave', channelPayloadSchema, async ({ channelId }) => {
    clearTyping(socket, channelId);
    socket.data.joinedChannels.delete(channelId);
    await socket.leave(channelRoom(channelId));

    nsp.to(channelRoom(channelId)).emit('presence', {
      channelId,
      users: await presenceOf(nsp, channelId),
    });

    return { channelId };
  });

  handle(socket, 'presence:list', channelPayloadSchema, async ({ channelId }) => {
    await service.resolveChannelById(socket.data.userId, channelId);

    const users = await presenceOf(nsp, channelId);

    /* Answered to the asker alone, not broadcast: nobody else's screen changes
       because one client asked a question. */
    socket.emit('presence', { channelId, users });

    return { channelId, users };
  });

  handle(socket, 'message:send', sendMessageSchema, async ({ channelId, content, clientId }) => {
    /* An `AppError`, the same class the services throw, so `handle` has one
       kind of failure to translate and the client sees `RATE_LIMITED` in the
       same envelope as every other refusal. */
    if (!takeToken(socket, 'message')) {
      throw new AppError(
        httpStatus.TOO_MANY_REQUESTS,
        'Too many messages, slow down',
        AUTH_CODES.RATE_LIMITED
      );
    }

    /* The row first. Only what the service returns is broadcast, so a failed
       insert cannot put a message on anybody's screen. */
    const message = await service.sendMessage(socket.data.userId, channelId, content);

    clearTyping(socket, channelId);
    broadcastTyping(socket, channelId, false);

    /* To the whole room INCLUDING the sender, and carrying the sender's own
       `clientId` back: that echo is what lets their client reconcile the
       optimistic bubble it already drew with the real row instead of rendering
       the message twice. The server never interprets or stores it. */
    nsp.to(channelRoom(channelId)).emit('message:new', { ...message, clientId: clientId ?? null });

    return { message, clientId: clientId ?? null };
  });

  handle(socket, 'message:edit', editMessageSchema, async ({ messageId, content }) => {
    const message = await service.editMessage(socket.data.userId, { messageId, content });

    nsp.to(channelRoom(message.channelId)).emit('message:edited', message);

    return { message };
  });

  handle(socket, 'message:delete', deleteMessageSchema, async ({ messageId }) => {
    const message = await service.deleteMessage(socket.data.userId, { messageId });

    /* The id, so clients drop the bubble. The tombstone itself is what history
       returns; a live client does not need the empty row to remove a line. */
    nsp.to(channelRoom(message.channelId)).emit('message:deleted', {
      id: message.id,
      channelId: message.channelId,
    });

    return { id: message.id };
  });

  /* Not persisted, and not membership-checked beyond the room: a socket can
     only broadcast into a room it was admitted to, and admission is where the
     check belongs. Storing "is typing" would be storing something already
     stale. */
  handle(socket, 'typing:start', channelPayloadSchema, async ({ channelId }) => {
    if (!socket.rooms.has(channelRoom(channelId))) return undefined;
    if (!takeToken(socket, 'typing')) return undefined;

    broadcastTyping(socket, channelId, true);

    clearTyping(socket, channelId);
    socket.data.typingTimers.set(
      channelId,
      setTimeout(() => {
        socket.data.typingTimers.delete(channelId);
        broadcastTyping(socket, channelId, false);
      }, TYPING_TIMEOUT_MS)
    );

    return undefined;
  });

  handle(socket, 'typing:stop', channelPayloadSchema, async ({ channelId }) => {
    clearTyping(socket, channelId);
    broadcastTyping(socket, channelId, false);

    return undefined;
  });

  socket.on('disconnecting', () => {
    /* `disconnecting`, not `disconnect`: the rooms are still readable here, and
       after disconnect they are not — so this is the only moment the remaining
       members can be told who left. */
    for (const room of socket.rooms) {
      if (!room.startsWith('channel:')) continue;

      const channelId = room.slice('channel:'.length);

      clearTyping(socket, channelId);
      socket.to(room).emit('typing', {
        channelId,
        userId: socket.data.userId,
        name: socket.data.user?.name ?? null,
        typing: false,
      });
    }
  });

  socket.on('disconnect', async () => {
    /* Presence AFTER the leave has taken effect, so `fetchSockets` no longer
       counts this connection — broadcasting from `disconnecting` would send a
       list that still contains the person who just left. */
    for (const channelId of socket.data.joinedChannels) {
      nsp.to(channelRoom(channelId)).emit('presence', {
        channelId,
        users: await presenceOf(nsp, channelId),
      });
    }

    for (const timer of socket.data.typingTimers.values()) clearTimeout(timer);
    socket.data.typingTimers.clear();
  });
};

/**
 * Registers the namespace on an existing `io`.
 *
 * `handshakeAuth` is applied here as well as on the root namespace because
 * Socket.IO middleware is per-namespace: auth is connection-level, and one
 * shared function is what keeps it from becoming feature-level.
 */
const registerChatNamespace = (io) => {
  const nsp = io.of('/chat');

  nsp.use(handshakeAuth);

  /**
   * **NOTHING IS AWAITED BEFORE THE LISTENERS ARE REGISTERED.** A client emits
   * `channel:join` the instant it connects, and Socket.IO does not queue an
   * event for a listener that does not exist yet — so an `await` above
   * `registerHandlers` silently drops whatever arrived during it. That is not a
   * race that shows up under a local database and then never again: it is one
   * dropped join, no error anywhere, and a channel that looks empty.
   *
   * The one thing this connection needs from Postgres — the user's display
   * name, for presence and typing — is therefore started here and awaited
   * inside `handle`.
   */
  nsp.on('connection', (socket) => {
    disconnectAtExpiry(socket);

    socket.data.user = null;
    /* One read per connection, cached for presence and typing. See
       `chat.repository.js#findUserSummary`: the alternative is a query per
       keystroke. A failure is not fatal — a missing name renders as null, and
       refusing the connection over it would take chat down for a cosmetic
       field. */
    socket.data.userReady = repository
      .findUserSummary(socket.data.userId)
      .then((user) => {
        socket.data.user = user;
      })
      .catch((err) => {
        log.warn({ err, userId: socket.data.userId }, 'Could not load chat display name');
      });

    registerHandlers(nsp, socket);

    log.debug({ userId: socket.data.userId, socketId: socket.id }, 'Chat socket connected');
  });

  return nsp;
};

export { registerChatNamespace };
export default { registerChatNamespace };
