"use client";

import { plural } from "@/lib/plural";

/**
 * The backlog's count, at the right end of the search/filter row — the one
 * place the page states how much is in it.
 *
 * It used to be its own line under the tabs, with "x of y shown" and
 * "Select all" on yet another; three small lines of grey text before the
 * first task. Now: "18 tasks, 3 sub-tasks" at rest, "6 of 18 tasks" while a
 * filter narrows the list, and "Select all" beside it only for someone who
 * can act on a selection and has not already selected everything shown.
 */
export function TaskBacklogSummary({
  total,
  subtasks,
  shown,
  filtered,
  canSelect,
  allSelected,
  onSelectAll,
}: {
  total: number;
  subtasks: number;
  shown: number;
  filtered: boolean;
  canSelect: boolean;
  allSelected: boolean;
  onSelectAll: () => void;
}) {
  const count = filtered
    ? `${shown} of ${plural(total, "task", "tasks")}`
    : `${plural(total, "task", "tasks")}${subtasks > 0 ? `, ${plural(subtasks, "sub-task", "sub-tasks")}` : ""}`;

  return (
    <p className="flex items-center gap-2 text-xs text-text-subtle tabular-nums">
      <span aria-live="polite">{count}</span>
      {canSelect && shown > 0 && !allSelected && (
        <button
          type="button"
          onClick={onSelectAll}
          className="cursor-pointer rounded-sm px-1.5 py-0.5 font-medium text-text-muted transition-colors duration-150 ease-standard hover:bg-surface-hover hover:text-text"
        >
          Select all
        </button>
      )}
    </p>
  );
}
