"use client";

import { useSortable } from "@dnd-kit/sortable";
import { PlanningRowMenu } from "@/components/sprint-planning/planning-row-menu";
import { StoryPointsPicker } from "@/components/tasks/story-points-picker";
import type { TaskScope } from "@/components/tasks/task-draft";
import { TaskRow } from "@/components/tasks/task-row";
import { TaskStatusChip } from "@/components/tasks/task-status-chip";
import { GripIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { ContainerId } from "@/lib/sprint-plan";
import type { Task } from "@/types/task";

/**
 * One task on the planning screen: the backlog row, plus its status chip and
 * the story-points picker on the right — the two things a planning session
 * reads and changes while deciding what fits.
 *
 * PICKED UP FROM ANYWHERE ON THE CARD: the pointer listeners sit on the whole
 * row, and `RowPointerSensor` plus a 6px distance keep clicks working
 * (`row-pointer-sensor.ts`). The grip stays as the visible affordance, the
 * touch handle (the row itself must still scroll a phone), and the keyboard
 * activator. `data.sprintId` is what lets a drop ON this row resolve to this
 * row's container. Someone who may not change tasks gets a plain row.
 */
export function PlanningTaskRow({
  task,
  sprintId,
  scope,
  siblings,
  selected,
  onOpen,
  onDelete,
  onSelect,
}: {
  task: Task;
  /** The rows of this task's box, for the menu's top / bottom moves. */
  siblings: Task[];
  sprintId: ContainerId;
  scope: TaskScope;
  selected: boolean;
  onOpen: () => void;
  onDelete?: () => void;
  onSelect?: (selected: boolean) => void;
}) {
  const canDrag = scope.canContribute;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { sprintId }, disabled: !canDrag });
  /* dnd-kit types its listeners as a bare `Function` map; this one is the
     pointer activator, attached to the whole card. */
  const onCardPointerDown = listeners?.onPointerDown as React.PointerEventHandler<HTMLDivElement> | undefined;

  return (
    <div
      ref={setNodeRef}
      onPointerDown={canDrag ? onCardPointerDown : undefined}
      style={{ transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined, transition }}
      className={cn(canDrag && "cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}
    >
      <TaskRow
        task={task}
        today={scope.today}
        onOpen={onOpen}
        selected={selected}
        onSelect={onSelect}
        menu={<PlanningRowMenu task={task} siblings={siblings} scope={scope} onOpen={onOpen} onDelete={onDelete} />}
        trailing={
          <>
            <TaskStatusChip status={task.status} />
            <StoryPointsPicker task={task} scope={scope} />
          </>
        }
        handle={
          canDrag ? (
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
          ) : undefined
        }
      />
    </div>
  );
}
