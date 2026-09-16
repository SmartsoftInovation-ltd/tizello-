"use client";

import { useState } from "react";
import { TaskFilterDialog } from "@/components/tasks/task-filter-dialog";
import type { TaskScope } from "@/components/tasks/task-draft";
import { buttonVariants } from "@/components/ui/button";
import { CloseIcon } from "@/components/ui/icons";
import { SearchIcon } from "@/components/ui/nav-icons";
import { FilterIcon } from "@/components/ui/table-icons";
import { activeFilterCount, NO_FILTERS, type TaskFilters } from "@/lib/task-filters";

/**
 * Search and filters for the backlog and sprint planning: a search box that is
 * always open, and one Filter button that opens `TaskFilterDialog` for Type,
 * Priority, Assignee and Tag.
 *
 * ALWAYS OPEN, unlike the projects search that collapses to an icon: on a
 * backlog, "find TIZ-42" is the most common thing anyone does, and this row has
 * the room.
 *
 * The Filter button carries `surface-hover` at rest — the app's rest fill for
 * toolbar controls — and a count of the narrowings inside it, so a filtered
 * list says so without opening anything. A Clear button sits beside it while
 * ANY narrowing is on, search included: two independent narrowings with no
 * shared indicator is how you end up staring at an empty list wondering why.
 *
 * Filtering is client-side over the whole backlog — `lib/task-filters.ts` says why.
 */
export function TaskBacklogFilters({
  filters,
  tags,
  scope,
  onChange,
}: {
  filters: TaskFilters;
  /** Tags in use in this project, most-used first. */
  tags: string[];
  scope: TaskScope;
  onChange: (next: TaskFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = activeFilterCount(filters);
  const inDialog = active - (filters.q.trim() ? 1 : 0);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <label className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-sm border border-border bg-surface px-2 focus-within:border-border-strong sm:max-w-72">
        <SearchIcon className="size-3.5 shrink-0 text-text-subtle" />
        <span className="sr-only">Search tasks by title or key</span>
        <input
          type="search"
          value={filters.q}
          placeholder="Search title or key"
          autoComplete="off"
          maxLength={80}
          onChange={(event) => onChange({ ...filters, q: event.target.value })}
          onKeyDown={(event) => event.key === "Escape" && onChange({ ...filters, q: "" })}
          className="min-w-0 flex-1 appearance-none bg-transparent text-xs text-text outline-none placeholder:text-text-subtle [&::-webkit-search-cancel-button]:hidden"
        />
      </label>

      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={inDialog > 0 ? `Filter tasks, ${inDialog} active` : "Filter tasks"}
        onClick={() => setOpen(true)}
        className={buttonVariants({ variant: "subtle", size: "sm", className: "h-8" })}
      >
        <FilterIcon className="size-3.5" />
        Filter
        {inDialog > 0 && (
          <span className="grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-2xs text-on-brand tabular-nums">
            {inDialog}
          </span>
        )}
      </button>

      {active > 0 && (
        <button
          type="button"
          onClick={() => onChange(NO_FILTERS)}
          className="flex h-7 items-center gap-1 rounded-sm px-2 text-xs text-text-muted transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
        >
          <CloseIcon className="size-3" />
          Clear {active === 1 ? "filter" : `${active} filters`}
        </button>
      )}

      <TaskFilterDialog
        open={open}
        filters={filters}
        tags={tags}
        scope={scope}
        active={inDialog}
        onChange={onChange}
        onOpenChange={setOpen}
      />
    </div>
  );
}
