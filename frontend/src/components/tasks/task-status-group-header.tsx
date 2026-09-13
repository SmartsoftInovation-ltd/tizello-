"use client";

import { useSortable } from "@dnd-kit/sortable";
import { TaskStatusAddForm } from "@/components/tasks/task-status-add-form";
import { PlusIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import {
  TASK_STATUS_GROUP_LABEL,
  type StatusColor,
  type TaskStatusGroup,
} from "@/types/task";

/**
 * A group's heading in the status editor — "To-do", "In Progress", "Complete" —
 * with the "+" that opens the add form under it.
 *
 * SORTABLE BUT NEVER DRAGGED. It takes part in the list so a status can be
 * dropped next to it (which is how a status changes group), and it cannot be
 * picked up itself: the three groups are fixed, in a fixed order.
 */
export function TaskStatusGroupHeader({
  id,
  group,
  adding,
  pending,
  onStartAdding,
  onAdd,
  onCancelAdding,
}: {
  id: string;
  group: TaskStatusGroup;
  adding: boolean;
  pending: boolean;
  onStartAdding: () => void;
  onAdd: (name: string, color: StatusColor) => void;
  onCancelAdding: () => void;
}) {
  const { setNodeRef, transform, transition } = useSortable({
    id,
    disabled: { draggable: true, droppable: false },
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
        transition: transition ?? undefined,
      }}
      className="pt-3 first:pt-1"
    >
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-2xs font-medium text-text-subtle">{TASK_STATUS_GROUP_LABEL[group]}</span>
        <button
          type="button"
          disabled={pending}
          onClick={adding ? onCancelAdding : onStartAdding}
          aria-expanded={adding}
          aria-label={`Add a status to ${TASK_STATUS_GROUP_LABEL[group]}`}
          className={cn(
            "grid size-6 place-items-center rounded-sm text-text-subtle transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text disabled:opacity-50",
            adding && "bg-surface-hover text-text",
          )}
        >
          <PlusIcon className={cn("size-3.5 transition-transform", adding && "rotate-45")} />
        </button>
      </div>

      {adding && (
        <TaskStatusAddForm group={group} pending={pending} onAdd={onAdd} onCancel={onCancelAdding} />
      )}
    </li>
  );
}
