"use client";

import { useId } from "react";
import { useDroppable } from "@dnd-kit/core";
import { DraggableTaskRow } from "@/components/tasks/draggable-task-row";
import { TaskRow } from "@/components/tasks/task-row";
import { TaskStatusChip } from "@/components/tasks/task-status-chip";
import { ChevronDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { Task, TaskStatusOption } from "@/types/task";

/**
 * One status's section of the backlog — its chip, its count, its rows — and a
 * drop target for a task dragged in from another status.
 *
 * THE WHOLE SECTION IS THE TARGET, header included, so a collapsed status can
 * still take a drop: collapsing is about what you are looking at, not about
 * what the section accepts. While something is over it the section takes a
 * dashed edge — the same "there is room here" signal the boards use.
 *
 * The list is hidden with `hidden` rather than unmounted, so `aria-controls`
 * always points at an element that exists.
 */
export function TaskStatusGroup({
  status,
  tasks,
  today,
  collapsed,
  canDrag,
  onToggle,
  onOpen,
  onDelete,
}: {
  status: TaskStatusOption;
  tasks: Task[];
  today: string;
  collapsed: boolean;
  /** Contributors can move tasks; a read-only viewer gets plain rows. */
  canDrag: boolean;
  onToggle: () => void;
  onOpen: (taskId: string) => void;
  onDelete?: (task: Task) => void;
}) {
  const panelId = useId();
  const { setNodeRef, isOver } = useDroppable({
    id: `status:${status.id}`,
    data: { statusId: status.id },
  });

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

      <ul id={panelId} hidden={collapsed} className="mt-1 space-y-1.5">
        {tasks.length === 0 ? (
          <li className="rounded-md border border-dashed border-border px-3 py-3 text-center text-xs text-text-subtle">
            {canDrag ? "Nothing here — drag a task in." : "Nothing here."}
          </li>
        ) : (
          tasks.map((task) => {
            const props = {
              task,
              today,
              onOpen: () => onOpen(task.id),
              onDelete: onDelete ? () => onDelete(task) : undefined,
            };
            return (
              <li key={task.id}>
                {canDrag ? <DraggableTaskRow {...props} /> : <TaskRow {...props} />}
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
