/**
 * Row → response shaping for task comments. A whitelist.
 *
 * `author` is `null` rather than absent when the author's account is gone
 * (`onDelete: SetNull`), so a client renders "Deleted user" from one branch
 * instead of guessing whether the field was just not loaded.
 *
 * See docs/api/task.md
 */

import { toPerson } from './task.dto.js';

const toComment = (row) => ({
  id: row.id,
  taskId: row.taskId,
  body: row.body,
  authorId: row.authorId,
  author: toPerson(row.author),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export { toComment };
export default { toComment };
