"use client";

import { defaultAnimateLayoutChanges, useSortable, type AnimateLayoutChanges } from "@dnd-kit/sortable";
import { SprintBoardCard } from "@/components/current-sprint/sprint-board-card";
import { cn } from "@/lib/cn";
import type { Task } from "@/types/task";

/**
 * A card that can be picked up — anywhere on it, like a planning row
 * (`row-pointer-sensor.ts` keeps clicks on the title working), with the
 * keyboard activator on the card itself. `data.statusId` is what lets a drop
 * ON this card resolve to its column. Someone who may not change tasks gets
 * the plain card.
 *
 * THE SLOT. While this card is held, its place in the list stays the card's
 * exact size but draws as a glowing dashed outline — the spot the lifted card
 * will snap back into. Because the hook moves the card between columns during
 * the drag, that slot travels with the pointer and neighbours slide apart to
 * make room on a slow ease-out (320ms) that settles rather than snaps.
 */
const SLIDE = { duration: 320, easing: "cubic-bezier(0.25, 1, 0.5, 1)" };

/* Animate EVERY layout change, including a card arriving from another column
   mid-drag — by default dnd-kit only animates reorders it started, so a
   cross-column insert snapped instead of gliding. */
const animateLayoutChanges: AnimateLayoutChanges = (args) => defaultAnimateLayoutChanges({ ...args, wasDragging: true });

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
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { statusId: task.statusId },
    disabled: !canDrag,
    transition: SLIDE,
    animateLayoutChanges,
  });

  return (
    <li
      /* The element itself is the keyboard activator, so Space typed in a field
         inside it (the quick add) never starts a drag — dnd-kit only checks
         the event target when an activator is set. */
      ref={(node) => {
        setNodeRef(node);
        setActivatorNodeRef(node);
      }}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
      aria-roledescription={canDrag ? "draggable card" : undefined}
      aria-label={canDrag ? `${task.key}, ${task.title}` : undefined}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition }}
      className={cn(
        "relative touch-manipulation rounded-md",
        canDrag && "cursor-grab active:cursor-grabbing",
        isDragging && "bg-brand-500/10 outline-2 -outline-offset-2 outline-brand-500/70 outline-dashed ring-4 ring-brand-500/10",
      )}
    >
      <div className={cn(isDragging && "invisible")}>
        <SprintBoardCard task={task} today={today} onOpen={onOpen} />
      </div>
    </li>
  );
}
