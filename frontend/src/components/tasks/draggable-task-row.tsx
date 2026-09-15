"use client";

import { useSortable } from "@dnd-kit/sortable";
import { TaskRow, type TaskRowProps } from "@/components/tasks/task-row";
import { GripIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * A backlog row that can be dragged to a new rank in its status, or onto
 * another status.
 *
 * PICKED UP FROM ANYWHERE ON THE CARD. The pointer listener sits on the whole
 * row; `RowPointerSensor` and its 6px distance keep a click a click, so the
 * title still opens the drawer (`row-pointer-sensor.ts`). The grip remains the
 * visible affordance, the touch handle — the row itself must still scroll on a
 * phone — and the keyboard activator: a real `<button>`, so Space picks the task
 * up and the arrow keys carry it. A press on the grip is not counted twice: dnd-kit
 * marks the event captured by the first activator it reaches.
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
  /* dnd-kit types its listeners as a bare `Function` map; this one is the
     pointer activator, attached to the whole card. */
  const onCardPointerDown = listeners?.onPointerDown as React.PointerEventHandler<HTMLDivElement> | undefined;

  return (
    <div
      ref={setNodeRef}
      onPointerDown={onCardPointerDown}
      /* Vertical only, as in `sortable-status-row.tsx` — the list is a column. */
      style={{ transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined, transition }}
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}
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
