"use client";

import { useId } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DraggableTaskRow } from "@/components/tasks/draggable-task-row";
import type { TaskScope } from "@/components/tasks/task-draft";
import { TaskQuickAdd } from "@/components/tasks/task-quick-add";
import { TaskRow } from "@/components/tasks/task-row";
import { StoryPointsPicker } from "@/components/tasks/story-points-picker";
import { TaskStatusChip } from "@/components/tasks/task-status-chip";
import { ChevronDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { Task, TaskStatusOption } from "@/types/task";

/**
 * One status's section of the backlog — its chip, its count, its rows in rank
 * order, and the quick-add composer — and a drop target for a task dragged in.
 *
 * THE WHOLE SECTION IS THE TARGET, header included, so a collapsed status can
 * still take a drop: collapsing is about what you are looking at, not about
 * what the section accepts. Dropping on the section rather than on a row
 * appends to the bottom. While something is over it the section takes a
 * dashed edge — the same "there is room here" signal the boards use.
 *
 * The rows are a `SortableContext`, which is what opens a gap under the pointer
 * while ranking (`draggable-task-row.tsx`).
 *
 * The list is hidden with `hidden` rather than unmounted, so `aria-controls`
 * always points at an element that exists.
 */
export function TaskStatusGroup({
  status,
  tasks,
  scope,
  collapsed,
  filtered,
  selected,
  onToggle,
  onOpen,
  onDelete,
  onSelect,
}: {
  status: TaskStatusOption;
  tasks: Task[];
  scope: TaskScope;
  collapsed: boolean;
  /** Filters are hiding rows — an empty section says so rather than "drag a task in". */
  filtered: boolean;
  selected: Set<string>;
  onToggle: () => void;
  onOpen: (taskId: string) => void;
  onDelete?: (task: Task) => void;
  onSelect?: (taskId: string, selected: boolean) => void;
}) {
  const panelId = useId();
  const canDrag = scope.canContribute;
  const { setNodeRef, isOver } = useDroppable({
    id: `status:${status.id}`,
    data: { statusId: status.id },
  });

  const empty = filtered ? "No matching tasks." : canDrag ? "Nothing here — drag a task in." : "Nothing here.";

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "mt-2 rounded-md border border-transparent p-1 transition-colors duration-100 ease-standard",
        isOver && "border-dashed border-border-strong bg-surface-hover",
      )}
    >
      <h3>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex max-w-full items-center gap-2 rounded-sm px-1 py-1 transition-colors duration-100 ease-standard hover:bg-surface-hover"
        >
          <ChevronDownIcon
            className={cn("size-3.5 shrink-0 text-text-subtle transition-transform", collapsed && "-rotate-90")}
          />
          <TaskStatusChip status={status} />
          <span className="text-xs text-text-subtle tabular-nums">{tasks.length}</span>
        </button>
      </h3>

      <div id={panelId} hidden={collapsed}>
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          <ul className="mt-1 space-y-1.5">
            {tasks.length === 0 ? (
              <li className="rounded-md border border-dashed border-border px-3 py-3 text-center text-xs text-text-subtle">
                {empty}
              </li>
            ) : (
              tasks.map((task) => {
                const props = {
                  task,
                  today: scope.today,
                  onOpen: () => onOpen(task.id),
                  onDelete: onDelete ? () => onDelete(task) : undefined,
                  selected: selected.has(task.id),
                  onSelect: onSelect ? (next: boolean) => onSelect(task.id, next) : undefined,
                  trailing: <StoryPointsPicker task={task} scope={scope} />,
                };
                return (
                  <li key={task.id}>
                    {canDrag ? <DraggableTaskRow {...props} /> : <TaskRow {...props} />}
                  </li>
                );
              })
            )}
          </ul>
        </SortableContext>

        {canDrag && <TaskQuickAdd scope={scope} where={status.name} statusId={status.id} />}
      </div>
    </section>
  );
}
