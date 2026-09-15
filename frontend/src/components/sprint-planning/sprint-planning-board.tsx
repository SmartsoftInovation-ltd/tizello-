"use client";

import { DndContext, DragOverlay } from "@dnd-kit/core";
import { NoSprintsCard } from "@/components/sprint-planning/no-sprints-card";
import { PlanningContainer } from "@/components/sprint-planning/planning-container";
import { PlanningOverlays } from "@/components/sprint-planning/planning-overlays";
import { PlanningToolbar } from "@/components/sprint-planning/planning-toolbar";
import { SprintHeader } from "@/components/sprint-planning/sprint-header";
import { usePlanningDnd } from "@/components/sprint-planning/use-planning-dnd";
import { usePlanningView } from "@/components/sprint-planning/use-planning-view";
import { useSprintDialogs } from "@/components/sprint-planning/use-sprint-dialogs";
import { TaskBacklogFilters } from "@/components/tasks/task-backlog-filters";
import type { TaskScope } from "@/components/tasks/task-draft";
import { TaskRow } from "@/components/tasks/task-row";
import { activeFilterCount, matchesFilters, tagsIn } from "@/lib/task-filters";
import { BACKLOG, containerTasks, openSprints, pointsByGroup } from "@/lib/sprint-plan";
import type { Task } from "@/types/task";

/**
 * Sprint planning, Jira-style: every open sprint as a box — the active one
 * first, then the queue — stacked above the backlog, and tasks dragged between
 * them. Estimating (the points pill), creating, starting and completing sprints
 * all happen on this one screen.
 *
 * SAME SURFACES AS THE BACKLOG. New task, a row's ⋯ menu, the task drawer, the
 * delete confirm and the bulk bar behave exactly as they do there
 * (`planning-overlays.tsx`) — the status editor deliberately stays on the backlog;
 * a sprint opens in that same drawer. What planning adds is "Move to" in the
 * row menu and the sprint boxes.
 *
 * THE LIST IS A PROP, NEVER STATE. Every write is a Server Action that
 * revalidates this route; the only local copy is the optimistic one a drag
 * holds (`use-planning-dnd.ts`). Filters narrow every box at once.
 */
const DRAG_INSTRUCTIONS = {
  draggable:
    "Press Space or Enter to pick this task up. Use the arrow keys to move it within this box or into another sprint or the backlog, then press Space or Enter to drop it, or Escape to cancel. The task's menu also has Move to.",
};

export function SprintPlanningBoard({ tasks, scope }: { tasks: Task[]; scope: TaskScope }) {
  const view = usePlanningView();
  const dialogs = useSprintDialogs();
  const visible = (task: Task) => matchesFilters(task, view.filters);
  const dnd = usePlanningDnd({ tasks, scope, visible });
  const filtered = activeFilterCount(view.filters) > 0;

  const sprints = openSprints(scope.sprints);
  const active = sprints.find((sprint) => sprint.state === "ACTIVE") ?? null;
  const backlog = containerTasks(dnd.tasks, null);
  const planned = sprints.flatMap((sprint) => containerTasks(dnd.tasks, sprint.id));
  const selectedIds = [...planned, ...backlog].filter((task) => visible(task) && view.selected.has(task.id)).map((task) => task.id);
  const shared = {
    scope,
    filtered,
    selected: view.selected,
    onOpen: view.openTask,
    onDelete: scope.canContribute ? view.setPendingDeletion : undefined,
    onSelect: scope.canContribute ? view.select : undefined,
  };

  return (
    <section>
      <PlanningToolbar
        planned={planned.length}
        waiting={backlog.length}
        canManage={scope.canManageProperties}
        canCreate={scope.canContribute}
        onCreateSprint={dialogs.create}
        onNewTask={() => view.openCreate()}
      />
      <TaskBacklogFilters filters={view.filters} tags={tagsIn(tasks)} scope={scope} onChange={view.setFilters} />

      <DndContext id="sprint-planning-drag" {...dnd.dndContextProps} accessibility={{ screenReaderInstructions: DRAG_INSTRUCTIONS }}>
        <div className="mt-4 space-y-3">
          {sprints.length === 0 && <NoSprintsCard canManage={scope.canManageProperties} onCreate={dialogs.create} />}

          {sprints.map((sprint) => {
            const rows = containerTasks(dnd.tasks, sprint.id);
            return (
              <PlanningContainer
                key={sprint.id}
                {...shared}
                sprintId={sprint.id}
                name={sprint.name}
                tasks={rows.filter(visible)}
                collapsed={view.isCollapsed(sprint.id)}
                emptyText="Plan this sprint: drag tasks here from the backlog, or use a task's ⋯ menu → Move to."
                onToggle={() => view.toggle(sprint.id)}
                header={
                  <SprintHeader
                    sprint={sprint}
                    count={rows.length}
                    points={pointsByGroup(rows)}
                    canManage={scope.canManageProperties}
                    canContribute={scope.canContribute}
                    today={scope.today}
                    blockedBy={active && active.id !== sprint.id ? active.name : null}
                    onAction={(action) => (action === "add-task" ? view.openCreate(sprint.id) : dialogs.act(sprint, action))}
                  />
                }
              />
            );
          })}

          <PlanningContainer
            {...shared}
            sprintId={null}
            name="Backlog"
            tasks={backlog.filter(visible)}
            collapsed={view.isCollapsed(BACKLOG)}
            emptyText={sprints.length > 0 ? "Everything is planned. New tasks land here." : "No tasks waiting. Add one below."}
            onToggle={() => view.toggle(BACKLOG)}
            header={
              <p className="ml-auto text-xs text-text-subtle tabular-nums">
                {backlog.length === 1 ? "1 task" : `${backlog.length} tasks`} · {pointsByGroup(backlog).total} pts
              </p>
            }
          />
        </div>

        <DragOverlay dropAnimation={null}>
          {dnd.activeTask ? (
            <div className="cursor-grabbing rounded-md shadow-raised">
              <TaskRow task={dnd.activeTask} today={scope.today} onOpen={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <PlanningOverlays tasks={tasks} scope={scope} selectedIds={selectedIds} view={view} dialogs={dialogs} />
    </section>
  );
}
