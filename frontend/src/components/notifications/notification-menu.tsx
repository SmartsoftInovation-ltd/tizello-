"use client";

import { useTransition } from "react";
import { NotificationItem } from "@/components/notifications/notification-item";
import { useNotificationSocket } from "@/components/notifications/use-notification-socket";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions/notification-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BellIcon } from "@/components/ui/nav-icons";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/plural";
import type { AppNotification } from "@/types/notification";

/*
 * The bell's menu: a count, a "mark all read", and the last fifteen.
 *
 * THE BADGE IS A NUMBER, NOT A DOT. "3" and "20" are different situations, and
 * a dot makes them look the same — somebody who has been away for a week
 * should be able to tell before opening it. It caps at `9+` because a
 * three-digit badge stops being a badge and starts being a layout problem.
 *
 * Reads are Server Actions that revalidate the shell's layout, and a new
 * notification arrives as a socket nudge that does the same thing — so the
 * badge always settles from the server rather than from a local copy that can
 * drift. The
 * transition is what keeps the menu from feeling stuck while that happens; the
 * row dims rather than disappearing, because a row that vanished under the
 * pointer would take the next one with it.
 */
const TRIGGER =
  "relative inline-flex size-8 items-center justify-center rounded-sm text-text-muted transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text";

const BADGE =
  "absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-2xs font-semibold tabular-nums text-on-brand";

export function NotificationMenu({
  notifications,
  unreadCount,
}: {
  notifications: AppNotification[];
  unreadCount: number;
}) {
  const [isPending, startTransition] = useTransition();

  /* Realtime. The socket only calls `router.refresh()`, so everything below
     keeps reading the same server-rendered props it did before — see
     `use-notification-socket.ts`. */
  useNotificationSocket();

  function readOne(notification: AppNotification) {
    if (notification.read) return;
    startTransition(async () => {
      await markNotificationReadAction(notification.id);
    });
  }

  function readAll() {
    if (unreadCount === 0) return;
    startTransition(async () => {
      await markAllNotificationsReadAction();
    });
  }

  return (
    <DropdownMenu className="relative">
      <DropdownMenuTrigger
        className={TRIGGER}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${plural(unreadCount, "unread", "unread")}`
            : "Notifications"
        }
      >
        <BellIcon className="size-4" />
        {unreadCount > 0 && (
          /* `aria-hidden`: the count is already in the trigger's accessible
             name above, and announcing it twice is noise. */
          <span aria-hidden="true" className={BADGE}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="text-xs font-semibold text-text">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-1 font-normal text-text-subtle tabular-nums">
                {unreadCount} unread
              </span>
            )}
          </p>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={readAll}
              disabled={isPending}
              className="rounded-xs text-2xs font-medium text-text-brand transition-colors duration-100 ease-standard hover:underline disabled:opacity-60"
            >
              Mark all read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-text-subtle">
            Nothing yet. You will hear about tasks assigned to you.
          </p>
        ) : (
          <ul className={cn("max-h-96 overflow-y-auto", isPending && "opacity-60")}>
            {notifications.map((notification) => (
              <li key={notification.id}>
                <NotificationItem
                  notification={notification}
                  onRead={() => readOne(notification)}
                />
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
