"use client";

import { useSortable } from "@dnd-kit/sortable";
import { SprintBoardCard } from "@/components/current-sprint/sprint-board-card";
import { cn } from "@/lib/cn";
import type { Task } from "@/types/task";

/**
 * A card that can be picked up — anywhere on it, like a planning row
 * (`row-pointer-sensor.ts` keeps clicks on the title working), with the
 * keyboard activator on the card itself. `data.statusId` is what lets a drop
 * ON this card resolve to its column. Someone who may not change tasks gets
 * the plain card.
 */
export function SortableSprintCard({
  task,
  today,
  canDrag,
  onOpen,
}: {
  task: Task;
  today: string;
  canDrag: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { statusId: task.statusId },
    disabled: !canDrag,
  });

  return (
    <li
      ref={setNodeRef}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
      aria-roledescription={canDrag ? "draggable card" : undefined}
      aria-label={canDrag ? `${task.key}, ${task.title}` : undefined}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition }}
      className={cn("touch-manipulation rounded-md", canDrag && "cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}
    >
      <SprintBoardCard task={task} today={today} onOpen={onOpen} />
    </li>
  );
}
