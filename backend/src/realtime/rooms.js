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
 * `channel:<id>` — one conversation, whatever it is attached to. Joined only
 * after `chat.service.js#resolveChannel` says the socket's user may use it.
 *
 * KEYED ON THE CHANNEL, not on the workspace or project behind it. That is the
 * payoff of the `Channel` table: a room name has one shape however many kinds
 * of channel exist, so adding a kind changes no room logic and a broadcast can
 * never be addressed to the wrong sort of id.
 */
const channelRoom = (channelId) => `channel:${channelId}`;

export { userRoom, channelRoom };
export default { userRoom, channelRoom };
