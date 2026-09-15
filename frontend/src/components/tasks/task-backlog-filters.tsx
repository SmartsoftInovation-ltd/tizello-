"use client";

import { MenuAction, MenuChoice, MenuHeading } from "@/components/projects/menu-choice";
import { ToolbarMenu } from "@/components/projects/toolbar-menu";
import { memberName, type TaskScope } from "@/components/tasks/task-draft";
import { TaskTypeIcon } from "@/components/tasks/task-type-icon";
import { CloseIcon } from "@/components/ui/icons";
import { SearchIcon } from "@/components/ui/nav-icons";
import { FilterIcon } from "@/components/ui/table-icons";
import { activeFilterCount, NO_FILTERS, type TaskFilters } from "@/lib/task-filters";
import { PROJECT_PRIORITIES, PROJECT_PRIORITY_LABEL } from "@/types/project";
import { TASK_TYPES, TASK_TYPE_LABEL } from "@/types/task";

/**
 * Search and filters for the backlog: a search box that is always open, and
 * one Filter menu for Type, Priority, Assignee and Tag.
 *
 * ALWAYS OPEN, unlike the projects search that collapses to an icon: on a
 * backlog, "find TIZ-42" is the most common thing anyone does, and this row has
 * the room.
 *
 * CLICKING THE CHOSEN VALUE CLEARS IT — the same gesture as the projects filter
 * menu, so a single-choice list never traps you with no way back to "any".
 * The pip stays on while ANY narrowing is on, search included, and a Clear
 * button sits beside the menu then: two independent narrowings with no shared
 * indicator is how you end up staring at an empty list wondering why.
 *
 * Filtering is client-side over the whole backlog — `lib/task-filters.ts` says why.
 */
const PANEL_HEIGHT = 440;

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
  const active = activeFilterCount(filters);
  const set = (patch: Partial<TaskFilters>) => onChange({ ...filters, ...patch });
  const toggle = <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) =>
    set({ [key]: filters[key] === value ? "" : value } as Partial<TaskFilters>);

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
          onChange={(event) => set({ q: event.target.value })}
          onKeyDown={(event) => event.key === "Escape" && set({ q: "" })}
          className="min-w-0 flex-1 appearance-none bg-transparent text-xs text-text outline-none placeholder:text-text-subtle [&::-webkit-search-cancel-button]:hidden"
        />
      </label>

      <ToolbarMenu
        icon={<FilterIcon className="size-3.5" />}
        label={active > 0 ? `Filter tasks, ${active} active` : "Filter tasks"}
        panelLabel="Filter tasks"
        height={PANEL_HEIGHT}
        dot={active > 0}
        closeOnSelect
      >
        <div className="max-h-[27rem] overflow-y-auto">
          <MenuHeading>Type</MenuHeading>
          {TASK_TYPES.map((type) => (
            <MenuChoice key={type} label={TASK_TYPE_LABEL[type]} selected={filters.type === type} adornment={<TaskTypeIcon type={type} />} onSelect={() => toggle("type", type)} />
          ))}

          <MenuHeading>Priority</MenuHeading>
          {PROJECT_PRIORITIES.map((priority) => (
            <MenuChoice key={priority} label={PROJECT_PRIORITY_LABEL[priority]} selected={filters.priority === priority} onSelect={() => toggle("priority", priority)} />
          ))}
          <MenuChoice label="No priority" selected={filters.priority === "none"} onSelect={() => toggle("priority", "none")} />

          <MenuHeading>Assignee</MenuHeading>
          <MenuChoice label="Assigned to me" selected={filters.assigneeId === scope.currentUserId} onSelect={() => toggle("assigneeId", scope.currentUserId)} />
          <MenuChoice label="Unassigned" selected={filters.assigneeId === "none"} onSelect={() => toggle("assigneeId", "none")} />
          {scope.members
            .filter((member) => member.userId !== scope.currentUserId)
            .map((member) => (
              <MenuChoice key={member.userId} label={memberName(member)} selected={filters.assigneeId === member.userId} onSelect={() => toggle("assigneeId", member.userId)} />
            ))}

          {tags.length > 0 && <MenuHeading>Tag</MenuHeading>}
          {tags.slice(0, 12).map((tag) => (
            <MenuChoice key={tag} label={tag} selected={filters.tag === tag} onSelect={() => toggle("tag", tag)} />
          ))}

          <MenuAction label="Clear filters" disabled={active === 0} onClick={() => onChange(NO_FILTERS)} />
        </div>
      </ToolbarMenu>

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
    </div>
  );
}
