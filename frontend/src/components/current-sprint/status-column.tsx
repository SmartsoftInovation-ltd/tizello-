"use client";

import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableSprintCard } from "@/components/current-sprint/sortable-sprint-card";
import type { TaskScope } from "@/components/tasks/task-draft";
import { TaskQuickAdd } from "@/components/tasks/task-quick-add";
import { TaskStatusChip } from "@/components/tasks/task-status-chip";
import { STATUS_COLUMN } from "@/components/tasks/task-tone";
import { PointsIcon } from "@/components/ui/points-icon";
import { cn } from "@/lib/cn";
import { columnKey } from "@/lib/current-sprint";
import type { Task, TaskStatusOption } from "@/types/task";

/**
 * One status as a column: its pill, card count and points, the cards in rank
 * order, and a quick add that files straight into this status AND this sprint.
 *
 * THE BOX IS WASHED IN THE STATUS'S OWN HUE (`STATUS_COLUMN`) and headed by
 * the same `TaskStatusChip` the backlog, the picker and the drawer use, so a
 * status looks like itself everywhere and the rail reads as its workflow at a
 * glance rather than as five identical grey boxes. The wash is deliberately
 * fainter than a card's — see the tone table for why.
 *
 * The brand ring for `isDragging` / `receiving` REPLACES the hue rather than
 * layering over it: two colours arguing over one box during a drag is how you
 * lose track of where the card is going.
 *
 * `w-list` (272px) like every column in the app, and exactly as tall as the
 * rail: the page fits the viewport, so a long column scrolls its OWN cards
 * (thin bar) with the header and quick add pinned. A fixed height also means a
 * card crossing columns never resizes one mid-drag.
 *
 * THE COLUMN IS SORTABLE TOO. A project writer can pick the whole column up —
 * from its header, its padding, anywhere that is not a card — and drop it
 * elsewhere on the rail (`use-column-dnd.ts`). A press on a card is captured by
 * the card first, so the two drags never start together. While carried, the
 * column's place shows as an empty dashed slot. For everyone the column is
 * still a drop target for cards, so an empty one still takes a card.
 *
 * `receiving` is set on the column the held card is currently IN — the one it
 * will land in — which lifts with a soft brand ring before the drop.
 */
const SLIDE = { duration: 320, easing: "cubic-bezier(0.25, 1, 0.5, 1)" };

export function StatusColumn({
  status,
  tasks,
  sprintId,
  scope,
  filtered,
  receiving,
  onOpen,
}: {
  status: TaskStatusOption;
  /** This column's visible cards, in rank order. */
  tasks: Task[];
  sprintId: string;
  scope: TaskScope;
  filtered: boolean;
  /** A card is being dragged and currently sits in this column. */
  receiving: boolean;
  onOpen: (taskId: string) => void;
}) {
  const canMove = scope.canManageProperties;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: columnKey(status.id),
    data: { type: "column", statusId: status.id },
    disabled: { draggable: !canMove, droppable: false },
    transition: SLIDE,
  });
  const points = tasks.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0);

  return (
    <section
      /* The element itself is the keyboard activator, so Space typed in a field
         inside it (the quick add) never starts a drag — dnd-kit only checks
         the event target when an activator is set. */
      ref={(node) => {
        setNodeRef(node);
        setActivatorNodeRef(node);
      }}
      data-board-column
      {...(canMove ? { ...attributes, ...listeners } : {})}
      aria-roledescription={canMove ? "draggable column" : undefined}
      aria-label={status.name}
      style={{ transform: transform ? `translate3d(${transform.x}px, 0, 0)` : undefined, transition }}
      className={cn(
        "flex h-full min-h-0 w-list shrink-0 flex-col rounded-lg border p-2 transition-[border-color,box-shadow,background-color] duration-300 ease-standard",
        canMove && "cursor-grab active:cursor-grabbing",
        /* Both drag states re-state `bg-panel`: the hue is a gradient over that
           base, so a state that only set a translucent fill would let the
           canvas through where the wash used to be. */
        isDragging
          ? "border-dashed border-brand-500/60 bg-panel bg-linear-to-b from-brand-500/8 to-brand-500/8"
          : receiving
            ? "border-brand-500/60 bg-panel bg-linear-to-b from-brand-500/12 to-brand-500/12 ring-4 ring-brand-500/15"
            : STATUS_COLUMN[status.color],
      )}
    >
      <div className={cn("flex min-h-0 flex-1 flex-col", isDragging && "invisible")}>
        <header className="flex items-center gap-2 px-0.5 pb-2">
          <h2 className="flex min-w-0">
            <TaskStatusChip status={status} />
          </h2>
          <span className="rounded-full bg-surface-hover px-1.5 text-2xs font-semibold text-text-muted tabular-nums">{tasks.length}</span>
          {points > 0 && (
            <span title="Story points in this column" className="ml-auto inline-flex items-center gap-1 text-2xs font-medium text-text-subtle tabular-nums">
              <PointsIcon className="size-3" />
              {points}
            </span>
          )}
        </header>

        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          <ul className="scrollbar-board -mr-1 flex min-h-0 flex-1 cursor-default flex-col gap-1.5 overflow-y-auto pr-1">
            {tasks.length === 0 ? (
              <li className="grid flex-1 place-items-center rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-text-subtle">
                {filtered ? "No matching tasks." : scope.canContribute ? "Drop a card here" : "Nothing here"}
              </li>
            ) : (
              tasks.map((task) => (
                <SortableSprintCard key={task.id} task={task} today={scope.today} canDrag={scope.canContribute} onOpen={() => onOpen(task.id)} />
              ))
            )}
          </ul>
        </SortableContext>

        {scope.canContribute && <TaskQuickAdd scope={scope} where={status.name} statusId={status.id} sprintId={sprintId} />}
      </div>
    </section>
  );
}
