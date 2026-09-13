"use client";

import { useSortable } from "@dnd-kit/sortable";
import { TaskStatusChip } from "@/components/tasks/task-status-chip";
import { ChevronDownIcon, GripIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { TaskStatusOption } from "@/types/task";

/**
 * One status in the editor: the grip, the chip, DEFAULT on the one new tasks
 * start in, and the chevron into its details.
 *
 * Two buttons, not one row that does both: the grip carries dnd-kit's pointer
 * and keyboard listeners, the rest of the row opens the detail view, and a
 * single element could not tell a press-and-drag from a click without guessing.
 *
 * The transform is vertical only — the list is a column, and letting a row
 * drift sideways under the pointer reads as if it could leave the dialog.
 */
export function SortableStatusRow({
  status,
  onOpen,
}: {
  status: TaskStatusOption;
  onOpen: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: status.id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
        transition: transition ?? undefined,
      }}
      className={cn(
        "flex items-center gap-1 rounded-sm px-0.5 hover:bg-surface-hover",
        isDragging && "relative z-10 bg-surface shadow-raised",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${status.name}`}
        className="grid size-6 shrink-0 cursor-grab touch-none place-items-center rounded-xs text-text-subtle hover:text-text active:cursor-grabbing"
      >
        <GripIcon className="size-3.5" />
      </button>

      <button
        type="button"
        onClick={onOpen}
        aria-label={`Edit ${status.name}${status.isDefault ? ", the default status" : ""}`}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-xs py-1.5 pr-1 text-left"
      >
        <TaskStatusChip status={status} />
        {status.isDefault && (
          <span className="ml-auto text-2xs font-medium tracking-wide text-text-subtle uppercase">
            Default
          </span>
        )}
        <ChevronDownIcon
          className={cn("size-3.5 shrink-0 -rotate-90 text-text-subtle", !status.isDefault && "ml-auto")}
        />
      </button>
    </li>
  );
}
