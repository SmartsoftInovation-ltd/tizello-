"use client";

import { Suspense, useState } from "react";
import { TaskActivityList } from "@/components/tasks/task-activity-list";
import { ChevronDownIcon } from "@/components/ui/icons";
import { listTaskActivityAction } from "@/lib/actions/task-bulk-actions";
import { cn } from "@/lib/cn";

/**
 * A task's history, collapsed until asked for.
 *
 * COLLAPSED BY DEFAULT because history is what you look for when something is
 * wrong ("who moved this back to To do?"), not what you read every time a task
 * opens — and the drawer already carries a comment thread below the fields.
 *
 * The request starts in the CLICK that expands the section, and the list
 * `use()`s the promise under `<Suspense>` — the same arrangement as comments,
 * for the same reason: no effect, and no request for 200 histories on a page
 * load. Collapsing and expanding again re-reads, so a change just saved shows.
 */
export function TaskActivity({ taskId }: { taskId: string }) {
  const [promise, setPromise] = useState<ReturnType<typeof listTaskActivityAction> | null>(null);

  function toggle() {
    setPromise((current) => (current ? null : listTaskActivityAction(taskId)));
  }

  return (
    <section className="mt-6 border-t border-border pt-4" aria-label="Activity">
      <h3>
        <button
          type="button"
          aria-expanded={promise !== null}
          onClick={toggle}
          className="flex items-center gap-1.5 rounded-sm px-0.5 text-xs font-medium text-text-subtle transition-colors duration-100 ease-standard hover:text-text"
        >
          <ChevronDownIcon className={cn("size-3.5 transition-transform", !promise && "-rotate-90")} />
          Activity
        </button>
      </h3>

      {promise && (
        <Suspense fallback={<p className="mt-2 text-2xs text-text-subtle">Loading history…</p>}>
          <TaskActivityList promise={promise} />
        </Suspense>
      )}
    </section>
  );
}
