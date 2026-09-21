"use client";

import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format-date";
import type { AppNotification } from "@/types/notification";

/*
 * One row in the bell's menu.
 *
 * A `<button>`, not a link, and that is the honest shape: there is no route
 * that opens a single task on its own — the board opens one through a drawer
 * keyed on the card. Until there is, the row's job is to mark itself read, and
 * dressing it as a link would promise navigation it cannot do.
 *
 * THE TIME IS ABSOLUTE, not "3 minutes ago". `format-date.ts` states the rule
 * and the reason: relative time depends on `now`, which is a different instant
 * on the server than it is at hydration, so React throws the node away with a
 * mismatch warning — and it goes stale on a tab nobody reloads.
 *
 * The unread mark is a dot AND a weight change, never colour alone.
 */
const ROW =
  "flex w-full items-start gap-2.5 border-b border-border px-3 py-2.5 text-left transition-colors duration-100 ease-standard last:border-b-0 hover:bg-surface-hover";

export function NotificationItem({
  notification,
  onRead,
}: {
  notification: AppNotification;
  onRead: () => void;
}) {
  const { read, title, body, sprintName, projectName, createdAt } = notification;
  /* The sprint is the answer this feature was built for, so it wins the one
     line of context a row has room for. The project is the fallback for
     backlog work, which belongs to no sprint. */
  const where = sprintName ?? projectName;

  return (
    <button type="button" onClick={onRead} className={ROW}>
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 size-1.5 shrink-0 rounded-full",
          read ? "bg-transparent" : "bg-brand-500",
        )}
      />

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-xs text-text",
            read ? "font-normal" : "font-semibold",
          )}
        >
          {title}
          {!read && <span className="sr-only"> (unread)</span>}
        </span>

        {body && (
          <span className="mt-0.5 block truncate text-2xs text-text-muted">
            {body}
          </span>
        )}

        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-2xs text-text-subtle">
          {where && (
            <>
              <span className="truncate">{where}</span>
              <span aria-hidden="true">&middot;</span>
            </>
          )}
          <span className="whitespace-nowrap">{formatDate(createdAt)}</span>
        </span>
      </span>
    </button>
  );
}
