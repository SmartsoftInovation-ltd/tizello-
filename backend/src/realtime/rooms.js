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
 * `channel:<workspaceId>` — the workspace's conversation. Joined only after
 * `chat.service.js#requireChannel` says the socket's user is a member.
 *
 * Named for the channel rather than the workspace so that a room and a
 * workspace id are never confused at a call site: `channel:` is the prefix a
 * chat broadcast is addressed to, and `user:` is the prefix a notification is.
 */
const channelRoom = (workspaceId) => `channel:${workspaceId}`;

export { userRoom, channelRoom };
export default { userRoom, channelRoom };
