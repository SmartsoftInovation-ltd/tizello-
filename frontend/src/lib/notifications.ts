import { apiCallWithRefresh } from "@/lib/api-client";
import type { AppNotification, NotificationPage } from "@/types/notification";

/*
 * The notification API — `backend/docs/api/notification.md`.
 *
 * **Not workspace-scoped**, unlike everything else in `lib/`: a notification
 * belongs to a person, who may be in five workspaces and wants one bell. There
 * is no id in any path here — the server reads the owner from the session.
 */

export type NotificationResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: string };

/**
 * `GET /notifications`. Returns an empty page rather than throwing — this runs
 * in a Server Component render, where a throw is a full error page, and a bell
 * that cannot load is not worth taking the app down for.
 *
 * The list carries `unreadCount` with it, so the badge and the dropdown come
 * from one request and cannot disagree by whatever arrived between two.
 */
export async function getNotifications(limit = 15): Promise<NotificationPage> {
  const result = await apiCallWithRefresh<NotificationPage>(
    `/notifications?limit=${limit}`,
  );

  return result.ok ? result.data : { notifications: [], unreadCount: 0 };
}

/** `PATCH /notifications/:id/read`. Idempotent — a second call changes nothing. */
export async function markNotificationRead(
  notificationId: string,
): Promise<NotificationResult<AppNotification>> {
  const result = await apiCallWithRefresh<{ notification: AppNotification }>(
    `/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "PATCH" },
  );

  return result.ok
    ? { ok: true, data: result.data.notification }
    : { ok: false, code: result.code };
}

/** `POST /notifications/read-all`. Answers with how many it changed. */
export async function markAllNotificationsRead(): Promise<NotificationResult<number>> {
  const result = await apiCallWithRefresh<{ count: number }>(
    "/notifications/read-all",
    { method: "POST" },
  );

  return result.ok ? { ok: true, data: result.data.count } : { ok: false, code: result.code };
}
