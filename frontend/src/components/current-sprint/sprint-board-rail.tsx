"use client";

import { useRef } from "react";
import { defaultDropAnimationSideEffects, DndContext, DragOverlay, type DropAnimation } from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { AddStatusColumn } from "@/components/current-sprint/add-status-column";
import { ColumnDragPreview } from "@/components/current-sprint/column-drag-preview";
import { SprintBoardCard } from "@/components/current-sprint/sprint-board-card";
import { StatusColumn } from "@/components/current-sprint/status-column";
import { useColumnDnd } from "@/components/current-sprint/use-column-dnd";
import { useSprintBoardDnd } from "@/components/current-sprint/use-sprint-board-dnd";
import { useBoardPan } from "@/components/projects/use-board-pan";
import type { TaskScope } from "@/components/tasks/task-draft";
import { cn } from "@/lib/cn";
import { columnKey, columnTasks } from "@/lib/current-sprint";
import type { Task } from "@/types/task";

/**
 * The columns and everything that moves them: one `DndContext` for both card
 * drags (`use-sprint-board-dnd.ts`) and whole-column drags (`use-column-dnd.ts`),
 * the drag overlay, and grab-the-background panning.
 *
 * THREE GESTURES, NEVER TWO AT ONCE. A press on a card drags the card; a press
 * anywhere else on a column drags the column (project writers only); a press on
 * the bare rail between columns pans it sideways. dnd-kit captures a press at
 * the innermost draggable, and the pan ignores cards, controls and — when
 * columns are draggable — columns.
 *
 * No wheel handling: the rail scrolls the way the browser scrolls it
 * (Shift+wheel, trackpad, scrollbar), plus panning.
 */
const DRAG_INSTRUCTIONS = {
  draggable:
    "Press Space or Enter to pick this card or column up. Use the arrow keys to move a card within its column or into another status, or a column along the board, then press Space or Enter to drop it, or Escape to cancel.",
};

/* A lifted card or column glides into its slot instead of vanishing — the "snap". */
const SNAP: DropAnimation = {
  duration: 320,
  easing: "cubic-bezier(0.25, 1, 0.5, 1)",
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0" } } }),
};

/* Near a rail edge while dragging, the columns scroll toward it. Gentle: a fast
   setting outran the eye and felt like a jump. */
const AUTO_SCROLL = { threshold: { x: 0.15, y: 0.15 }, acceleration: 6 };

export function SprintBoardRail({
  dnd,
  sprintId,
  scope,
  filtered,
  visible,
  onOpen,
}: {
  dnd: ReturnType<typeof useSprintBoardDnd>;
  sprintId: string;
  scope: TaskScope;
  filtered: boolean;
  visible: (task: Task) => boolean;
  onOpen: (taskId: string) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const board = useColumnDnd({ scope, cards: dnd });
  const pan = useBoardPan(
    railRef,
    dnd.activeTask !== null || board.activeColumn !== null,
    scope.canManageProperties ? "[data-board-column]" : undefined,
  );

  return (
    <DndContext
      id="current-sprint-drag"
      {...board.dndContextProps}
      autoScroll={AUTO_SCROLL}
      accessibility={{ screenReaderInstructions: DRAG_INSTRUCTIONS }}
    >
      <div
        ref={railRef}
        {...pan.handlers}
        className={cn(
          "scrollbar-board mt-3 flex min-h-0 flex-1 items-stretch gap-3 overflow-x-auto overflow-y-hidden pb-2",
          pan.panning ? "cursor-grabbing select-none" : "cursor-grab",
        )}
      >
        <SortableContext items={board.columns.map((status) => columnKey(status.id))} strategy={horizontalListSortingStrategy}>
          {board.columns.map((status) => (
            <StatusColumn
              key={status.id}
              status={status}
              tasks={columnTasks(dnd.tasks, status.id).filter(visible)}
              sprintId={sprintId}
              scope={scope}
              filtered={filtered}
              receiving={dnd.activeTask?.statusId === status.id}
              onOpen={onOpen}
            />
          ))}
        </SortableContext>
        {scope.canManageProperties && <AddStatusColumn scope={scope} />}
      </div>

      <DragOverlay dropAnimation={SNAP}>
        {dnd.activeTask ? (
          <div className="w-full rotate-1 scale-[1.02] cursor-grabbing rounded-md ring-2 ring-brand-500/40">
            <SprintBoardCard task={dnd.activeTask} today={scope.today} onOpen={() => {}} lifted />
          </div>
        ) : board.activeColumn ? (
          <ColumnDragPreview
            status={board.activeColumn}
            tasks={columnTasks(dnd.tasks, board.activeColumn.id).filter(visible)}
            today={scope.today}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
