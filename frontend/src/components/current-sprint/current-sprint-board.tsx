"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { AddStatusColumn } from "@/components/current-sprint/add-status-column";
import { SprintBoardCard } from "@/components/current-sprint/sprint-board-card";
import { SprintBoardHeader } from "@/components/current-sprint/sprint-board-header";
import { StatusColumn } from "@/components/current-sprint/status-column";
import { useSprintBoardDnd } from "@/components/current-sprint/use-sprint-board-dnd";
import { PlanningOverlays } from "@/components/sprint-planning/planning-overlays";
import { usePlanningView } from "@/components/sprint-planning/use-planning-view";
import { useSprintDialogs } from "@/components/sprint-planning/use-sprint-dialogs";
import { TaskBacklogFilters } from "@/components/tasks/task-backlog-filters";
import type { TaskScope } from "@/components/tasks/task-draft";
import { TaskStatusEditor } from "@/components/tasks/task-status-editor";
import { useWheelScrollX } from "@/components/ui/use-wheel-scroll-x";
import { activeSprint, boardColumns, columnTasks, sprintTasks } from "@/lib/current-sprint";
import { pointsByGroup } from "@/lib/sprint-plan";
import { activeFilterCount, matchesFilters, tagsIn } from "@/lib/task-filters";
import type { Task } from "@/types/task";

/**
 * The current sprint board: the project's ACTIVE sprint, one column per task
 * status, cards dragged between them.
 *
 * COLUMNS ARE NOT FIXED. They are the project's statuses (`lib/current-sprint.ts`),
 * so "Review" or "QA" is a column the moment it exists — added from the
 * "+ Add status" column at the end, or managed (rename, recolour, reorder,
 * delete) in the Statuses dialog, the same editor the backlog uses.
 *
 * SAME SURFACES AS PLANNING. The task drawer, delete confirm and Complete
 * sprint dialog are planning's own (`planning-overlays.tsx`), so completing a
 * sprint here behaves exactly as it does there.
 *
 * THE LIST IS A PROP, NEVER STATE. Every write is a Server Action that
 * revalidates this route; the only local copy is the optimistic one a drag
 * holds (`use-sprint-board-dnd.ts`).
 */
const DRAG_INSTRUCTIONS = {
  draggable:
    "Press Space or Enter to pick this card up. Use the arrow keys to move it within its column or into another status, then press Space or Enter to drop it, or Escape to cancel.",
};

export function CurrentSprintBoard({
  tasks,
  scope,
  actions,
  planningHref,
}: {
  tasks: Task[];
  scope: TaskScope;
  actions?: React.ReactNode;
  /** Where "no active sprint" sends people. */
  planningHref: string;
}) {
  const sprint = activeSprint(scope.sprints);
  const view = usePlanningView();
  const dialogs = useSprintDialogs();
  const [statusEditor, setStatusEditor] = useState({ open: false, key: 0 });
  const visible = (task: Task) => matchesFilters(task, view.filters);
  const railRef = useRef<HTMLDivElement>(null);
  /* A vertical wheel over the columns scrolls them sideways, smoothly. */
  useWheelScrollX(railRef);
  const dnd = useSprintBoardDnd({ tasks: sprint ? sprintTasks(tasks, sprint.id) : [], scope, visible });

  if (!sprint) {
    return (
      <div className="mt-6 rounded-md border border-dashed border-border bg-surface-sunken px-4 py-10 text-center">
        <p className="text-sm font-medium text-text">No sprint is running</p>
        <p className="mt-1 text-xs text-text-muted">Start a sprint on sprint planning and its board shows up here.</p>
        <Link href={planningHref} className="mt-3 inline-block text-xs font-medium text-text-brand hover:underline">
          Go to sprint planning &rarr;
        </Link>
      </div>
    );
  }

  const columns = boardColumns(scope.statuses);

  return (
    <section>
      <SprintBoardHeader
        sprint={sprint}
        count={dnd.tasks.length}
        points={pointsByGroup(dnd.tasks)}
        today={scope.today}
        canManage={scope.canManageProperties}
        canContribute={scope.canContribute}
        actions={actions}
        onEditStatuses={() => setStatusEditor((current) => ({ open: true, key: current.key + 1 }))}
        onNewTask={() => view.openCreate(sprint.id)}
        onComplete={() => dialogs.act(sprint, "complete")}
      />
      <TaskBacklogFilters filters={view.filters} tags={tagsIn(dnd.tasks)} scope={scope} onChange={view.setFilters} />

      <DndContext id="current-sprint-drag" {...dnd.dndContextProps} accessibility={{ screenReaderInstructions: DRAG_INSTRUCTIONS }}>
        <div ref={railRef} className="scrollbar-board mt-4 flex items-stretch gap-3 overflow-x-auto pb-3">
          {columns.map((status) => (
            <StatusColumn
              key={status.id}
              status={status}
              tasks={columnTasks(dnd.tasks, status.id).filter(visible)}
              sprintId={sprint.id}
              scope={scope}
              filtered={activeFilterCount(view.filters) > 0}
              onOpen={view.openTask}
            />
          ))}
          {scope.canManageProperties && <AddStatusColumn scope={scope} />}
        </div>

        <DragOverlay dropAnimation={null}>
          {dnd.activeTask ? (
            <div className="w-list cursor-grabbing">
              <SprintBoardCard task={dnd.activeTask} today={scope.today} onOpen={() => {}} lifted />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <PlanningOverlays tasks={tasks} scope={scope} selectedIds={[]} view={view} dialogs={dialogs} />

      {statusEditor.key > 0 && (
        <TaskStatusEditor
          key={statusEditor.key}
          open={statusEditor.open}
          scope={scope}
          onOpenChange={(open) => setStatusEditor((current) => ({ ...current, open }))}
        />
      )}
    </section>
  );
}
