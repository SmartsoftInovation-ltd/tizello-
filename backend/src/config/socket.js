/**
 * The Socket.IO server: one connection per browser tab, authenticated from the
 * same access-token cookie every HTTP request uses, and joined to exactly one
 * room — its own user.
 *
 * WHY A ROOM PER USER AND NOTHING ELSE. A notification has an audience of one,
 * so `user:<id>` is the entire addressing scheme this needs. Rooms per
 * workspace or per project would each be a new way to leak somebody else's
 * data, and none of them is required to deliver "you were assigned a task".
 *
 * AUTH IS THE COOKIE, not a token in the handshake payload. The access token
 * is `httpOnly` precisely so page JavaScript cannot read it; a socket that
 * asked the client to hand one over would undo that. Cookies ignore PORT, so
 * the browser attaches `tizello_access` to `localhost:5000` even though it was
 * stored against `localhost:3000` — in production the two hosts differ and
 * `COOKIE_DOMAIN` is what keeps this working. `credentials: true` in the CORS
 * options below is the other half; without it the browser sends nothing.
 *
 * THE SOCKET DIES WITH THE TOKEN. The access token now lasts five minutes, and
 * a connection authenticated once would otherwise outlive it by hours. Each
 * socket schedules its own disconnect at `exp`; the client reconnects, and its
 * reconnect path refreshes the session first (see `use-notification-socket.ts`).
 * Re-verifying on a timer without disconnecting would be the same work and
 * would leave a live socket belonging to a revoked session.
 *
 * See docs/api/notification.md §Realtime
 */

import { Server } from 'socket.io';
import { parseCookie } from 'cookie';

import config from './env.js';
import { createLogger } from './logger.js';
import { ACCESS_COOKIE } from '../shared/utils/cookies.js';
import { verifyAccessToken } from '../shared/utils/tokens.js';

const log = createLogger('socket');

/** `user:<id>` — the only room this server uses. */
const userRoom = (userId) => `user:${userId}`;

let io = null;

/**
 * Attaches Socket.IO to the running HTTP server.
 *
 * Called from `index.js` with the server `app.listen` returns, so the socket
 * shares the port: one origin for the browser, one CORS rule, and no second
 * listener to expose or forget to shut down.
 */
const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: config.clientOrigin, credentials: true },
    /* The default 45s is generous for a notification bell that sends nothing.
       Shorter intervals mean a dead tab is reaped sooner and a stale token is
       noticed sooner. */
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.use((socket, next) => {
    const header = socket.handshake.headers.cookie;
    /* `parseCookie`, not `parse` — cookie@2 renamed it. The package is a
       direct dependency here rather than borrowed from cookie-parser's nested
       copy, which is pinned to 0.7 and would break under this import. */
    const token = header ? parseCookie(header)[ACCESS_COOKIE] : null;

    if (!token) {
      /* The client branches on this message to decide whether to refresh the
         session and retry, or to give up quietly — so it is part of the
         contract, not a log line. */
      return next(new Error('UNAUTHENTICATED'));
    }

    try {
      const decoded = verifyAccessToken(token);
      socket.data.userId = decoded.sub ?? decoded.id;
      socket.data.expiresAt = decoded.exp ? decoded.exp * 1000 : null;

      if (!socket.data.userId) return next(new Error('UNAUTHENTICATED'));

      return next();
    } catch {
      /* Expired and forged are the same answer here. The client's response to
         both is identical — refresh and retry — and telling it which is free
         reconnaissance, exactly as `toAuthError` in `middlewares/auth.js`
         refuses to. */
      return next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, expiresAt } = socket.data;

    socket.join(userRoom(userId));
    log.debug({ userId, socketId: socket.id }, 'Socket connected');

    /* See the header: the connection must not outlive the credential that
       opened it. `Math.max(0, …)` guards a token that expired between the
       handshake and here. */
    if (expiresAt) {
      const timer = setTimeout(
        () => socket.disconnect(true),
        Math.max(0, expiresAt - Date.now())
      );
      socket.on('disconnect', () => clearTimeout(timer));
    }
  });

  log.info('Socket.IO ready');
  return io;
};

/**
 * Sends an event to one user, on every tab they have open.
 *
 * A NO-OP WHEN THE SERVER IS NOT UP, and that is deliberate: the email worker
 * and the test scripts import the notification service without ever calling
 * `initSocket`, and a realtime push is a courtesy on top of a row that is
 * already written. Throwing here would make a side-effect fail the write it
 * decorates.
 */
const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return;

  io.to(userRoom(userId)).emit(event, payload);
};

const getIo = () => io;

const closeSocket = async () => {
  if (io) await io.close();
  io = null;
};

export { initSocket, emitToUser, getIo, closeSocket, userRoom };
