import type { TaskPerson } from "@/types/task";

/*
 * A task's history, as `GET /tasks/:taskId/activity` returns it —
 * `backend/docs/api/task.md` §Activity. Its own file beside `task.ts`, which is
 * at the line cap.
 */

/** The fields a history entry can be about — `docs/api/task.md` §Activity. */
export type TaskActivityField =
  | "title"
  | "description"
  | "type"
  | "status"
  | "priority"
  /** Entries written before a task could have several people — one `{ id, name }`. */
  | "assignee"
  | "assignees"
  | "dueDate"
  | "storyPoints"
  | "sprint"
  | "tags"
  | "parent"
  | "attachments"
  | "properties";

/** One history entry. `from` / `to` are display snapshots, shaped per field. */
export type TaskActivity = {
  id: string;
  taskId: string;
  actorId: string | null;
  actor: TaskPerson | null;
  action: "created" | "updated" | "commented";
  field: TaskActivityField | null;
  from: unknown;
  to: unknown;
  createdAt: string;
};
