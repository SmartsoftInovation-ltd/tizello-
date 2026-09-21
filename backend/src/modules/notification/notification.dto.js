/**
 * Row → response shaping for notifications. A whitelist, like `member.dto.js`
 * and `role.dto.js` — never a `delete row.field` blacklist, so a column added
 * to `Notification` later cannot leak by default.
 *
 * `read` is derived from `readAt` rather than stored alongside it: two fields
 * that can disagree about the same fact is one field too many, and the client
 * renders a dot, not a timestamp.
 *
 * `title` and `body` come straight off the row. They were written at send time
 * and are deliberately NOT recomputed from the task — a notification is a
 * record of what someone was told, and it must stay true after the task is
 * renamed.
 *
 * See docs/api/notification.md
 */

const toNotification = (row) => ({
  id: row.id,
  type: row.type,
  title: row.title,
  body: row.body,
  read: row.readAt !== null,
  readAt: row.readAt,
  taskId: row.taskId,
  projectName: row.projectName,
  sprintName: row.sprintName,
  actor: row.actor
    ? { id: row.actor.id, name: row.actor.name, email: row.actor.email }
    : null,
  createdAt: row.createdAt,
});

export { toNotification };
export default { toNotification };
