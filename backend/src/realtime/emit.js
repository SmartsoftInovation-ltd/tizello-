/**
 * Server-initiated pushes: the only way code outside `src/realtime/` sends
 * anything to a browser.
 *
 * **A NO-OP WHEN THE SERVER IS NOT UP, and that is deliberate:** the email
 * worker and the test scripts import `notification.service.js` without ever
 * calling `initSocket`, and a realtime push is a courtesy on top of a row that
 * is already written. Throwing here would make a side-effect fail the write it
 * decorates.
 *
 * Both functions take a room from `rooms.js` rather than a name, because a
 * room name spelled at a call site is a broadcast into an empty room the first
 * time somebody mistypes it — indistinguishable from a client bug.
 *
 * See .claude/plan/chat.md §4.1, docs/api/notification.md §Realtime
 */

import { getIo } from './server.js';
import { projectRoom, userRoom } from './rooms.js';

/** One person, on every tab they have open. The notification bell. */
const emitToUser = (userId, event, payload) => {
  const io = getIo();

  if (!io || !userId) return;

  io.to(userRoom(userId)).emit(event, payload);
};

/**
 * Everyone currently joined to a project's channel, on the `/chat` namespace.
 *
 * The namespace is explicit: a project room exists on `/chat` and nowhere
 * else, so `io.to(...)` on the root namespace would reach nobody. That failure
 * is silent, which is why this function exists instead of the call being
 * spelled out at each site.
 */
const emitToProject = (projectId, event, payload) => {
  const io = getIo();

  if (!io || !projectId) return;

  io.of('/chat').to(projectRoom(projectId)).emit(event, payload);
};

export { emitToUser, emitToProject };
export default { emitToUser, emitToProject };
