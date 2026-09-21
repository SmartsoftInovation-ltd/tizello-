"use server";

import { revalidatePath } from "next/cache";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";

/*
 * Notification writes. Thin by rule: call a plain function from
 * `lib/notifications.ts`, revalidate, return a code the leaf renders.
 *
 * `revalidatePath("/", "layout")` rather than a route: the bell lives in the
 * app shell, so the unread count is on EVERY page under it. Revalidating the
 * layout is what makes the badge correct after a read wherever the reader
 * happens to be standing.
 */

export type NotificationActionResult =
  | { ok: true }
  | { ok: false; code: string };

export async function markNotificationReadAction(
  notificationId: string,
): Promise<NotificationActionResult> {
  const result = await markNotificationRead(notificationId);
  if (!result.ok) return result;

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<NotificationActionResult> {
  const result = await markAllNotificationsRead();
  if (!result.ok) return result;

  revalidatePath("/", "layout");
  return { ok: true };
}
