"use client";

import { use } from "react";
import type { listTaskActivityAction } from "@/lib/actions/task-bulk-actions";
import { formatDate } from "@/lib/format-date";
import { describeActivity } from "@/lib/task-activity-copy";

/**
 * The entries themselves, newest first. `use()` of a promise started in the
 * click that expanded the section (`task-activity.tsx`), so there is no
 * effect and no request for a history nobody opened.
 */
export function TaskActivityList({
  promise,
}: {
  promise: ReturnType<typeof listTaskActivityAction>;
}) {
  const { code, activity } = use(promise);

  if (code) {
    return <p className="mt-2 text-2xs text-danger">The history didn&rsquo;t load. Reopen the task to try again.</p>;
  }

  if (activity.length === 0) {
    return <p className="mt-2 text-2xs text-text-subtle">Nothing recorded yet.</p>;
  }

  return (
    <ol className="mt-2 space-y-2 border-l border-border pl-3">
      {activity.map((entry) => {
        const actor = entry.actor ? (entry.actor.name ?? entry.actor.email.split("@")[0]) : "A former member";

        return (
          <li key={entry.id} className="text-xs text-text-muted">
            <span className="font-semibold text-text">{actor}</span> {describeActivity(entry)}
            <time dateTime={entry.createdAt} className="ml-1.5 text-2xs text-text-subtle">
              {formatDate(entry.createdAt)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
