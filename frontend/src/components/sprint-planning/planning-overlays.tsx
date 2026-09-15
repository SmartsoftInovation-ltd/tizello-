"use client";

import { SprintDialogs } from "@/components/sprint-planning/sprint-dialogs";
import type { usePlanningView } from "@/components/sprint-planning/use-planning-view";
import type { useSprintDialogs } from "@/components/sprint-planning/use-sprint-dialogs";
import { TaskBulkBar } from "@/components/tasks/task-bulk-bar";
import { TaskDeleteDialog } from "@/components/tasks/task-delete-dialog";
import type { TaskScope } from "@/components/tasks/task-draft";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { TaskStatusEditor } from "@/components/tasks/task-status-editor";
import type { Task } from "@/types/task";

/**
 * Everything on the planning screen that opens ABOVE the boxes — the same set
 * the backlog has, so both screens behave alike: the task drawer (view, edit,
 * and create — seeded into a sprint when opened from one), the delete confirm,
 * the status editor, the bulk bar, and the sprint drawer and confirms.
 *
 * Its own component for the board's line cap, and because none of these draw
 * anything until their state says so.
 */
export function PlanningOverlays({
  tasks,
  scope,
  selectedIds,
  view,
  dialogs,
}: {
  tasks: Task[];
  scope: TaskScope;
  selectedIds: string[];
  view: ReturnType<typeof usePlanningView>;
  dialogs: ReturnType<typeof useSprintDialogs>;
}) {
  const creating = view.drawer.taskId === null;
  const editing = creating ? null : (tasks.find((task) => task.id === view.drawer.taskId) ?? null);

  return (
    <>
      {selectedIds.length > 0 && <TaskBulkBar selectedIds={selectedIds} scope={scope} onClear={view.clearSelection} />}

      <TaskDrawer
        /* A task deleted while its drawer was open has nothing left to show. */
        open={view.drawer.open && (creating || editing !== null)}
        task={editing}
        sprintId={creating ? view.drawer.sprintId : undefined}
        scope={scope}
        tasks={tasks}
        commentsPromise={view.commentsPromise}
        onOpenChange={view.setDrawerOpen}
        onOpenTask={view.openTask}
      />

      <TaskDeleteDialog task={view.pendingDeletion} scope={scope} onClose={() => view.setPendingDeletion(null)} />

      {scope.canManageProperties && (
        <TaskStatusEditor
          key={view.statusEditor.key}
          open={view.statusEditor.open}
          scope={scope}
          onOpenChange={view.setStatusesOpen}
        />
      )}

      <SprintDialogs dialog={dialogs.dialog} dialogKey={dialogs.key} tasks={tasks} scope={scope} onClose={dialogs.close} />
    </>
  );
}
