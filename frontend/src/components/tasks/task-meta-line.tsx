import { formatDate } from "@/lib/format-date";
import type { Task } from "@/types/task";

/**
 * "Created by Sam on 12 Sep 2026 · Updated 14 Sep 2026" — under the title.
 *
 * A line, not two property rows: nobody edits either fact, and two read-only
 * rows among editable ones read as controls that do nothing. A creator whose
 * account is gone is "a former member", because the task outlives them.
 */
export function TaskMetaLine({ task }: { task: Task }) {
  const creator = task.createdBy
    ? (task.createdBy.name ?? task.createdBy.email.split("@")[0])
    : "a former member";
  const edited = task.updatedAt.slice(0, 10) !== task.createdAt.slice(0, 10);

  return (
    <p className="mt-2 text-2xs text-text-subtle">
      Created by <span className="font-medium text-text-muted">{creator}</span> on{" "}
      <time dateTime={task.createdAt}>{formatDate(task.createdAt)}</time>
      {edited && (
        <>
          {" "}
          &middot; Updated <time dateTime={task.updatedAt}>{formatDate(task.updatedAt)}</time>
        </>
      )}
    </p>
  );
}
