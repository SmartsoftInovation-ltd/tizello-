/**
 * Room names. One file, so no two features invent a different spelling of the
 * same audience.
 *
 * A room name is a wire contract in every way that matters: `emitToProject`
 * writes it and a namespace handler reads it, and a typo in either is not an
 * error — it is a broadcast into an empty room, which looks exactly like a
 * client bug. Naming them here means the typo is impossible rather than
 * findable.
 *
 * See .claude/plan/chat.md §4.1
 */

/** `user:<id>` — one person, every tab they have open. Notifications. */
const userRoom = (userId) => `user:${userId}`;

/**
 * `project:<id>` — a project's channel. Joined only after
 * `resolveProjectAccess` says the socket's user is a member of it; see
 * `chat.namespace.js`.
 */
const projectRoom = (projectId) => `project:${projectId}`;

export { userRoom, projectRoom };
export default { userRoom, projectRoom };
