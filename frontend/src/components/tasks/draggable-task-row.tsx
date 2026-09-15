"use client";

import { useSortable } from "@dnd-kit/sortable";
import { TaskRow, type TaskRowProps } from "@/components/tasks/task-row";
import { GripIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * A backlog row that can be dragged to a new rank in its status, or onto
 * another status.
 *
 * DRAGGED BY ITS GRIP ONLY. The title is a button that opens the drawer, and a
 * whole-row drag would turn every slightly unsteady click into a move. The grip
 * is a real `<button>` carrying dnd-kit's keyboard listeners, so Space picks
 * the task up and the arrow keys carry it — not a pointer-only affordance.
 *
 * `useSortable`, not `useDraggable`: the order inside a status IS the backlog's
 * priority now (`position`, `backend/docs/api/task.md` §Ordering), so the rows
 * around the pointer open a gap where the task will land. `data.statusId` is
 * what lets a drop ON a row resolve to that row's status.
 */
export function DraggableTaskRow(props: Omit<TaskRowProps, "handle">) {
  const { task } = props;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { statusId: task.statusId } });

  return (
    <div
      ref={setNodeRef}
      /* Vertical only, as in `sortable-status-row.tsx` — the list is a column. */
      style={{ transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined, transition }}
      className={cn(isDragging && "opacity-40")}
    >
      <TaskRow
        {...props}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Move ${task.key}, ${task.title}`}
            className="mt-0.5 grid size-5 shrink-0 cursor-grab touch-none place-items-center rounded-xs text-text-subtle transition-colors duration-100 ease-standard hover:bg-surface-sunken hover:text-text active:cursor-grabbing"
          >
            <GripIcon className="size-3.5" />
          </button>
        }
      />
    </div>
  );
}
