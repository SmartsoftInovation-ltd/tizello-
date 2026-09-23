/**
 * Row → response shaping for chat, plus the cursor codec.
 *
 * A whitelist, like `notification.dto.js` and `member.dto.js` — never a
 * `delete row.field` blacklist, so a column added to `Message` later cannot
 * leak by default.
 *
 * **TOMBSTONES DROP THEIR TEXT HERE.** A soft-deleted message keeps its row so
 * that a reply quoting it does not dangle, and this is the single place the
 * content is replaced with `null`. Every read path — the history page and the
 * live broadcast alike — goes through `toMessage`, so no caller is in a
 * position to forget.
 *
 * `sender: null` for a departed member: `Message.senderId` is `SetNull`
 * because a channel is the record of a conversation, and the client renders
 * "deleted user" rather than crashing on a missing join.
 *
 * See docs/api/chat.md §4 and .claude/skills/module-consistency/SKILL.md
 */

const SENDER_FIELDS = ['id', 'name', 'email', 'avatarUrl'];

const toSender = (sender) =>
  sender
    ? Object.fromEntries(SENDER_FIELDS.map((field) => [field, sender[field] ?? null]))
    : null;

const toMessage = (row) => {
  const deleted = row.deletedAt !== null;

  return {
    id: row.id,
    projectId: row.projectId,
    // See the header: a tombstone never carries its text out of this function.
    content: deleted ? null : row.content,
    deleted,
    editedAt: row.editedAt,
    createdAt: row.createdAt,
    sender: toSender(row.sender),
  };
};

/**
 * THE CURSOR IS `(createdAt, id)`, base64, and opaque.
 *
 * A timestamp alone is not a position. Two messages can share a millisecond —
 * one `message:send` burst is enough — and a strict `createdAt <` comparison
 * then either drops the tie-mate or repeats it forever, depending on which
 * side of the comparison it lands. The id breaks the tie, and it is resolved
 * from the same `(projectId, createdAt)` index entry the page is already
 * scanning, so the fix costs nothing.
 *
 * Opaque because a client that can parse a cursor will eventually construct
 * one, and from that day the encoding is a public format nobody can change.
 * The server never reads a cursor it did not write — `decodeCursor` returns
 * `null` for anything malformed and the validator turns that into a
 * `VALIDATION_ERROR`, rather than silently serving page 1 to a client that
 * believes it is paging.
 */
const encodeCursor = (row) =>
  row ? Buffer.from(`${row.createdAt.toISOString()}|${row.id}`, 'utf8').toString('base64url') : null;

const decodeCursor = (value) => {
  if (!value) return null;

  const decoded = Buffer.from(value, 'base64url').toString('utf8');
  const separator = decoded.lastIndexOf('|');

  if (separator < 1) return null;

  const at = new Date(decoded.slice(0, separator));
  const id = decoded.slice(separator + 1);

  if (Number.isNaN(at.getTime()) || !id) return null;

  return { at, id };
};

export { toMessage, encodeCursor, decodeCursor };
export default { toMessage, encodeCursor, decodeCursor };
