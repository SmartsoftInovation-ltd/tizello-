"use client";

import { useId } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { PlanningTaskRow } from "@/components/sprint-planning/planning-task-row";
import type { TaskScope } from "@/components/tasks/task-draft";
import { TaskQuickAdd } from "@/components/tasks/task-quick-add";
import { ChevronDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { containerKey, type ContainerId } from "@/lib/sprint-plan";
import type { Task } from "@/types/task";

/**
 * One box on the planning screen — a sprint or the backlog: a header, its rows
 * in rank order, and a quick-add. The whole box is a drop target, so an empty
 * sprint, a collapsed one, or the space under its last row all take a drop,
 * which appends.
 *
 * Jira's backlog view, deliberately: sprints stacked above the backlog in one
 * scroll, so planning is dragging DOWN-to-UP across boxes rather than juggling
 * two panels. The header's content differs (a sprint has dates, points and
 * lifecycle buttons; the backlog has "Create sprint"), so it is a slot.
 *
 * The rows are hidden with `hidden`, not unmounted, so `aria-controls` always
 * points at an element that exists.
 */
export function PlanningContainer({
  sprintId,
  name,
  tasks,
  scope,
  collapsed,
  filtered,
  selected,
  header,
  emptyText,
  onToggle,
  onOpen,
  onDelete,
  onSelect,
}: {
  sprintId: ContainerId;
  name: string;
  tasks: Task[];
  scope: TaskScope;
  collapsed: boolean;
  filtered: boolean;
  selected: Set<string>;
  /** Everything right of the chevron and name. */
  header: React.ReactNode;
  emptyText: string;
  onToggle: () => void;
  onOpen: (taskId: string) => void;
  onDelete?: (task: Task) => void;
  onSelect?: (taskId: string, selected: boolean) => void;
}) {
  const panelId = useId();
  const { setNodeRef, isOver } = useDroppable({ id: containerKey(sprintId), data: { sprintId } });

  return (
    <section
      ref={setNodeRef}
      aria-label={name}
      className={cn(
        "rounded-lg border bg-panel p-2 transition-colors duration-100 ease-standard",
        isOver ? "border-dashed border-brand-500 bg-success-subtle" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1">
        <h2 className="min-w-0">
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={panelId}
            onClick={onToggle}
            className="flex max-w-full items-center gap-1.5 rounded-sm px-1 py-1 text-sm font-semibold text-text transition-colors duration-100 ease-standard hover:bg-surface-hover"
          >
            <ChevronDownIcon className={cn("size-3.5 shrink-0 text-text-subtle transition-transform", collapsed && "-rotate-90")} />
            <span className="truncate">{name}</span>
          </button>
        </h2>
        {header}
      </div>

      <div id={panelId} hidden={collapsed} className="mt-2">
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1.5">
            {tasks.length === 0 ? (
              <li className="rounded-md border border-dashed border-border-strong bg-surface px-3 py-5 text-center text-xs text-text-muted">
                {filtered ? "No matching tasks." : emptyText}
              </li>
            ) : (
              tasks.map((task) => (
                <li key={task.id}>
                  <PlanningTaskRow
                    task={task}
                    sprintId={sprintId}
                    siblings={tasks}
                    scope={scope}
                    selected={selected.has(task.id)}
                    onOpen={() => onOpen(task.id)}
                    onDelete={onDelete ? () => onDelete(task) : undefined}
                    onSelect={onSelect ? (next) => onSelect(task.id, next) : undefined}
                  />
                </li>
              ))
            )}
          </ul>
        </SortableContext>

        {scope.canContribute && <TaskQuickAdd scope={scope} where={name} sprintId={sprintId} />}
      </div>
    </section>
  );
}
