"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableSprintCard } from "@/components/current-sprint/sortable-sprint-card";
import type { TaskScope } from "@/components/tasks/task-draft";
import { TaskQuickAdd } from "@/components/tasks/task-quick-add";
import { STATUS_DOT } from "@/components/tasks/task-tone";
import { PointsIcon } from "@/components/ui/points-icon";
import { cn } from "@/lib/cn";
import { columnKey } from "@/lib/current-sprint";
import type { Task, TaskStatusOption } from "@/types/task";

/**
 * One status as a column: its dot, name, card count and points, the cards in
 * rank order, and a quick add that files straight into this status AND this
 * sprint.
 *
 * `w-list` (272px) like every column in the app, and `min-h-board` on the
 * track so a card crossing columns never changes a column's height mid-drag —
 * the reason `DESIGN-SYSTEM.md` §Board geometry gives. The whole column is the
 * droppable, so an empty one still takes a card, and it tints while one is
 * over it.
 */
export function StatusColumn({
  status,
  tasks,
  sprintId,
  scope,
  filtered,
  onOpen,
}: {
  status: TaskStatusOption;
  /** This column's visible cards, in rank order. */
  tasks: Task[];
  sprintId: string;
  scope: TaskScope;
  filtered: boolean;
  onOpen: (taskId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey(status.id), data: { statusId: status.id } });
  const points = tasks.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0);

  return (
    <section
      ref={setNodeRef}
      aria-label={status.name}
      className={cn(
        "flex w-list shrink-0 flex-col rounded-lg border bg-panel p-2 transition-colors duration-100 ease-standard",
        isOver ? "border-dashed border-brand-500 bg-success-subtle" : "border-border",
      )}
    >
      <header className="flex items-center gap-2 px-1 pb-2">
        <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[status.color])} />
        <h2 className="min-w-0 truncate text-xs font-semibold tracking-wide text-text uppercase">{status.name}</h2>
        <span className="rounded-full bg-surface-hover px-1.5 text-2xs font-semibold text-text-muted tabular-nums">{tasks.length}</span>
        {points > 0 && (
          <span title="Story points in this column" className="ml-auto inline-flex items-center gap-1 text-2xs font-medium text-text-subtle tabular-nums">
            <PointsIcon className="size-3" />
            {points}
          </span>
        )}
      </header>

      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex min-h-board flex-1 flex-col gap-1.5">
          {tasks.length === 0 ? (
            <li className="rounded-md border border-dashed border-border-strong px-3 py-6 text-center text-xs text-text-subtle">
              {filtered ? "No matching tasks." : scope.canContribute ? "Drop a card here" : "Nothing here"}
            </li>
          ) : (
            tasks.map((task) => (
              <SortableSprintCard
                key={task.id}
                task={task}
                today={scope.today}
                canDrag={scope.canContribute}
                onOpen={() => onOpen(task.id)}
              />
            ))
          )}
        </ul>
      </SortableContext>

      {scope.canContribute && <TaskQuickAdd scope={scope} where={status.name} statusId={status.id} sprintId={sprintId} />}
    </section>
  );
}
