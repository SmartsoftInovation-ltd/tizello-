/**
 * The realtime layer: one Socket.IO server, one handshake middleware, and one
 * namespace per feature.
 *
 * This file is the layer's wiring and nothing else. It builds the `Server`,
 * applies `auth.js` to every namespace, keeps the notification bell's room on
 * the root namespace, and hands `/chat` to `chat.namespace.js`. A feature's
 * event handlers never appear here — adding call signaling is one new
 * `*.namespace.js` plus one line below.
 *
 * WHY A NAMESPACE PER FEATURE, and not more rooms on `/`. A namespace is its
 * own event table: `message:send` on `/chat` cannot collide with a
 * call-signaling event of the same name, and a handler registered on the wrong
 * namespace is a connection error rather than a silent cross-feature
 * broadcast. Rooms answer "who receives this"; namespaces answer "what events
 * exist". Using rooms for the second is what makes two features share one
 * event table and, eventually, one bug.
 *
 * Grew out of `src/config/socket.js`, which was written when notifications
 * were the only realtime feature and held all of this in one file. The split
 * is .claude/plan/chat.md §4.1.
 *
 * See docs/api/chat.md §2, docs/api/notification.md §Realtime
 */

import { Server } from 'socket.io';

import config from '../config/env.js';
import { createLogger } from '../config/logger.js';
import { disconnectAtExpiry, handshakeAuth } from './auth.js';
import { getIo, setIo } from './server.js';
import { registerChatNamespace } from './chat.namespace.js';
import { userRoom } from './rooms.js';

const log = createLogger('socket');

/**
 * The root namespace: the notification bell, and nothing else.
 *
 * ONE ROOM, ITS OWN USER. A notification has an audience of one, so
 * `user:<id>` is the entire addressing scheme it needs. Project rooms live on
 * `/chat`, where membership is checked before a socket may join one; putting
 * them here as well would be a second door into the same audience with no
 * check behind it.
 */
const registerRootNamespace = (io) => {
  io.use(handshakeAuth);

  io.on('connection', (socket) => {
    const { userId } = socket.data;

    socket.join(userRoom(userId));
    log.debug({ userId, socketId: socket.id }, 'Socket connected');

    disconnectAtExpiry(socket);
  });
};

/**
 * Attaches Socket.IO to the running HTTP server.
 *
 * Called from `index.js` with the server `app.listen` returns, so the socket
 * shares the port: one origin for the browser, one CORS rule, and no second
 * listener to expose or forget to shut down.
 */
const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: config.clientOrigin, credentials: true },
    /* The default 45s is generous for a notification bell that sends nothing.
       Shorter intervals mean a dead tab is reaped sooner and a stale token is
       noticed sooner. */
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  setIo(io);

  registerRootNamespace(io);
  registerChatNamespace(io);

  log.info('Socket.IO ready');
  return io;
};

const closeSocket = async () => {
  const io = getIo();

  if (io) await io.close();

  setIo(null);
};

export { initSocket, closeSocket, getIo };
export default { initSocket, closeSocket, getIo };
