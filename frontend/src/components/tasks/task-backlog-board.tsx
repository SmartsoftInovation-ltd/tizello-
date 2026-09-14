"use client";

import { useState } from "react";
import { DndContext, DragOverlay, type Announcements } from "@dnd-kit/core";
import type { TaskScope } from "@/components/tasks/task-draft";
import { TaskRow } from "@/components/tasks/task-row";
import { TaskStatusGroup } from "@/components/tasks/task-status-group";
import { useTaskStatusDnd } from "@/components/tasks/use-task-status-dnd";
import type { Task } from "@/types/task";

/**
 * The backlog's body: every TODO-group status of the project as a section,
 * inside one drag context.
 *
 * NOT-STARTED WORK ONLY — see the note beside `todoStatuses` below for why.
 *
 * EVERY TODO STATUS IS DRAWN, EMPTY ONES INCLUDED. A status with no tasks is
 * still somewhere a task can be dropped, and a section that only appears once
 * it has something in it is a target you cannot reach.
 *
 * TOP-LEVEL TASKS ONLY. A sub-task is reached through its parent's Relations,
 * the way Notion nests them; a sub-task whose parent is gone is top-level.
 *
 * `id` on the context is load-bearing for the same reason `BoardCanvas` gives:
 * dnd-kit's fallback id is a module counter that differs between the server
 * and hydration.
 */
const INSTRUCTIONS = {
  draggable:
    "Press Space or Enter to pick this task up. Use the arrow keys to move it over another status, then press Space or Enter to drop it there, or Escape to cancel.",
};

export function TaskBacklogBoard({
  tasks,
  scope,
  onOpen,
  onDelete,
}: {
  tasks: Task[];
  scope: TaskScope;
  onOpen: (taskId: string) => void;
  onDelete?: (task: Task) => void;
}) {
  const dnd = useTaskStatusDnd({ tasks, scope });
  const [collapsed, setCollapsed] = useState<string[]>([]);

  /*
   * BACKLOG SHOWS NOT-STARTED WORK ONLY. Once a task moves into an
   * IN_PROGRESS or COMPLETE status it is being worked, and the sprint board
   * is where in-flight work lives (`.claude/rules/workflow.md`) — leaving it
   * in the backlog too read as the backlog holding everything, which is what
   * confused people. Moving a task's status off TODO is what retires it from
   * this list; the row itself, comments and history are untouched.
   */
  const todoStatuses = scope.statuses.filter((status) => status.group === "TODO");
  const todoStatusIds = new Set(todoStatuses.map((status) => status.id));
  const ids = new Set(dnd.tasks.map((task) => task.id));
  const topLevel = dnd.tasks.filter(
    (task) => todoStatusIds.has(task.statusId) && (!task.parentId || !ids.has(task.parentId)),
  );

  const keyOf = (id: string | number) => tasks.find((task) => task.id === id)?.key ?? "Task";
  const statusName = (data?: Record<string, unknown>) =>
    scope.statuses.find((status) => status.id === data?.statusId)?.name ?? "no status";

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${keyOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      `${keyOf(active.id)} is over ${over ? statusName(over.data.current) : "no status"}.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${keyOf(active.id)} moved to ${statusName(over.data.current)}.`
        : `${keyOf(active.id)} was dropped outside a status and stayed where it was.`,
    onDragCancel: ({ active }) => `Moving ${keyOf(active.id)} cancelled.`,
  };

  function toggle(statusId: string) {
    setCollapsed((current) =>
      current.includes(statusId) ? current.filter((id) => id !== statusId) : [...current, statusId],
    );
  }

  return (
    <DndContext
      id="backlog-status-drag"
      {...dnd.dndContextProps}
      accessibility={{ announcements, screenReaderInstructions: INSTRUCTIONS }}
    >
      {/* One group, not three — see the note above. No group heading either:
          with only "To do" statuses ever drawn here, a heading that always
          reads "To do" tells nobody anything. */}
      <div className="mt-4">
        {todoStatuses.map((status) => (
          <TaskStatusGroup
            key={status.id}
            status={status}
            tasks={topLevel.filter((task) => task.statusId === status.id)}
            today={scope.today}
            collapsed={collapsed.includes(status.id)}
            canDrag={scope.canContribute}
            onToggle={() => toggle(status.id)}
            onOpen={onOpen}
            onDelete={onDelete}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {dnd.activeTask ? (
          <div className="cursor-grabbing rounded-md shadow-raised">
            <TaskRow task={dnd.activeTask} today={scope.today} onOpen={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
