/**
 * The Socket.IO handshake middleware: proves who a connection belongs to,
 * once, before any namespace sees it.
 *
 * AUTH IS THE COOKIE, not a token in the handshake payload. The access token
 * is `httpOnly` precisely so page JavaScript cannot read it; a socket that
 * asked the client to hand one over would undo that. Cookies ignore PORT, so
 * the browser attaches `tizello_access` to `localhost:5000` even though it was
 * stored against `localhost:3000` — in production the two hosts differ and
 * `COOKIE_DOMAIN` is what keeps this working. `credentials: true` in the CORS
 * options (see `index.js`) is the other half; without it the browser sends
 * nothing.
 *
 * **Auth is connection-level, not feature-level.** This same function is
 * applied to the root namespace and to `/chat`, and to whatever namespace comes
 * next, so there is one place that decides what a socket's identity is and one
 * field — `socket.data.userId` — that anything downstream may trust. A
 * namespace that authenticated its own connections would be a second answer to
 * the same question.
 *
 * Moved verbatim out of `config/socket.js` when the realtime layer was split
 * per .claude/plan/chat.md §4.1. See docs/api/notification.md §Realtime.
 */

import { parseCookie } from 'cookie';

import { ACCESS_COOKIE } from '../shared/utils/cookies.js';
import { verifyAccessToken } from '../shared/utils/tokens.js';

/**
 * Socket.IO middleware signature: `(socket, next)`, where `next(error)` refuses
 * the connection. Sets `socket.data.userId` and `socket.data.expiresAt`.
 */
const handshakeAuth = (socket, next) => {
  const header = socket.handshake.headers.cookie;
  /* `parseCookie`, not `parse` — cookie@2 renamed it. The package is a direct
     dependency here rather than borrowed from cookie-parser's nested copy,
     which is pinned to 0.7 and would break under this import. */
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
};

/**
 * THE SOCKET DIES WITH THE TOKEN. The access token lasts five minutes, and a
 * connection authenticated once would otherwise outlive it by hours. Each
 * socket schedules its own disconnect at `exp`; the client reconnects, and its
 * reconnect path refreshes the session first (see `use-notification-socket.ts`).
 * Re-verifying on a timer without disconnecting would be the same work and
 * would leave a live socket belonging to a revoked session.
 *
 * Applied per namespace on connection, because a namespace's sockets are
 * distinct objects even when they share a browser connection.
 *
 * `Math.max(0, …)` guards a token that expired between the handshake and here.
 */
const disconnectAtExpiry = (socket) => {
  const { expiresAt } = socket.data;

  if (!expiresAt) return;

  const timer = setTimeout(() => socket.disconnect(true), Math.max(0, expiresAt - Date.now()));

  socket.on('disconnect', () => clearTimeout(timer));
};

export { handshakeAuth, disconnectAtExpiry };
export default { handshakeAuth, disconnectAtExpiry };
