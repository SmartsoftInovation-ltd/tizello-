"use client";

import { useState } from "react";
import Link from "next/link";
import { SprintBoardHeader } from "@/components/current-sprint/sprint-board-header";
import { SprintBoardRail } from "@/components/current-sprint/sprint-board-rail";
import { useSprintBoardDnd } from "@/components/current-sprint/use-sprint-board-dnd";
import { PlanningOverlays } from "@/components/sprint-planning/planning-overlays";
import { usePlanningView } from "@/components/sprint-planning/use-planning-view";
import { useSprintDialogs } from "@/components/sprint-planning/use-sprint-dialogs";
import { TaskBacklogFilters } from "@/components/tasks/task-backlog-filters";
import type { TaskScope } from "@/components/tasks/task-draft";
import { TaskStatusEditor } from "@/components/tasks/task-status-editor";
import { activeSprint, sprintTasks } from "@/lib/current-sprint";
import { pointsByGroup } from "@/lib/sprint-plan";
import { activeFilterCount, matchesFilters, tagsIn } from "@/lib/task-filters";
import type { Task } from "@/types/task";

/**
 * The current sprint board: the project's ACTIVE sprint, one column per task
 * status, cards and whole columns dragged along the rail (`sprint-board-rail.tsx`).
 *
 * COLUMNS ARE NOT FIXED. They are the project's statuses (`lib/current-sprint.ts`),
 * so "Review" or "QA" is a column the moment it exists — added from the
 * "+ Add status" column at the end, reordered by dragging a column, or managed
 * (rename, recolour, delete) in the Statuses dialog the backlog uses.
 *
 * SAME SURFACES AS PLANNING. The task drawer, delete confirm and Complete
 * sprint dialog are planning's own (`planning-overlays.tsx`), so completing a
 * sprint here behaves exactly as it does there.
 *
 * THE LIST IS A PROP, NEVER STATE. Every write is a Server Action that
 * revalidates this route; the only local copies are the optimistic ones a drag
 * holds. The card drag hook lives here, not in the rail, because the header's
 * counts must move with a dragged card too.
 */
export function CurrentSprintBoard({
  tasks,
  scope,
  actions,
  planningHref,
}: {
  tasks: Task[];
  scope: TaskScope;
  /** The project picker, drawn beside Statuses. */
  actions?: React.ReactNode;
  /** Where "no active sprint" sends people. */
  planningHref: string;
}) {
  const sprint = activeSprint(scope.sprints);
  const view = usePlanningView();
  const dialogs = useSprintDialogs();
  const [statusEditor, setStatusEditor] = useState({ open: false, key: 0 });
  const visible = (task: Task) => matchesFilters(task, view.filters);
  const dnd = useSprintBoardDnd({ tasks: sprint ? sprintTasks(tasks, sprint.id) : [], scope, visible });

  if (!sprint) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-border bg-panel px-4 py-12 text-center">
        <p className="text-sm font-semibold text-text">No sprint is running</p>
        <p className="mt-1 text-xs text-text-muted">Start a sprint on sprint planning and its board shows up here.</p>
        <Link href={planningHref} className="mt-3 inline-block text-xs font-medium text-text-brand hover:underline">
          Go to sprint planning &rarr;
        </Link>
      </div>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
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

      <SprintBoardRail
        dnd={dnd}
        sprintId={sprint.id}
        scope={scope}
        filtered={activeFilterCount(view.filters) > 0}
        visible={visible}
        onOpen={view.openTask}
      />

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
