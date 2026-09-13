"use client";

import { useDraggable } from "@dnd-kit/core";
import { TaskRow } from "@/components/tasks/task-row";
import { GripIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { Task } from "@/types/task";

/**
 * A backlog row that can be picked up and dropped on another status.
 *
 * DRAGGED BY ITS GRIP ONLY. The title is a button that opens the drawer, and a
 * whole-row drag would turn every slightly unsteady click into a status change.
 * The grip is a real `<button>` carrying dnd-kit's keyboard listeners, so Space
 * picks the task up and the arrow keys carry it — not a pointer-only affordance.
 *
 * `useDraggable`, not `useSortable`: a drop CHANGES STATUS and the order inside
 * a status is creation order, so there is no in-list position to write. The
 * row stays put, dimmed, while `DragOverlay` in the board carries the copy.
 */
export function DraggableTaskRow({
  task,
  today,
  onOpen,
  onDelete,
}: {
  task: Task;
  today: string;
  onOpen: () => void;
  onDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { statusId: task.statusId },
  });

  return (
    <div ref={setNodeRef} className={cn(isDragging && "opacity-40")}>
      <TaskRow
        task={task}
        today={today}
        onOpen={onOpen}
        onDelete={onDelete}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Move ${task.key}, ${task.title}, to another status`}
            className="mt-0.5 grid size-5 shrink-0 cursor-grab touch-none place-items-center rounded-xs text-text-subtle transition-colors duration-100 ease-standard hover:bg-surface-sunken hover:text-text active:cursor-grabbing"
          >
            <GripIcon className="size-3.5" />
          </button>
        }
      />
    </div>
  );
}
