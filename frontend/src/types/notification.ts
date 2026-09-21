/*
 * A notification as the API returns it — `backend/docs/api/notification.md`.
 *
 * `read` is derived server-side from `readAt`, and both travel: the dot is
 * drawn from the boolean, and "read 2 minutes ago" is available without the
 * client re-deriving it from a nullable timestamp.
 *
 * `title` and `body` are frozen at send time on purpose. A notification is a
 * record of what somebody was told, so "cokof assigned you ECS-1" stays true
 * after the task is renamed — which is why neither is recomputed from `taskId`.
 */

export const NOTIFICATION_TYPES = ["TASK_ASSIGNED"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  read: boolean;
  readAt: string | null;
  /** What it points at. Null once the task has been deleted. */
  taskId: string | null;
  projectName: string | null;
  /** The sprint the task sits in, when it sits in one. Null for backlog work. */
  sprintName: string | null;
  actor: { id: string; name: string | null; email: string } | null;
  createdAt: string;
};

export type NotificationPage = {
  notifications: AppNotification[];
  unreadCount: number;
};
