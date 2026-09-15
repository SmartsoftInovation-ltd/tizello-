"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";
import type { TaskScope } from "@/components/tasks/task-draft";
import { moveTaskAction } from "@/lib/actions/task-bulk-actions";
import { byRank } from "@/lib/task-filters";
import { rankTarget } from "@/lib/task-rank";
import { containerTasks, type ContainerId } from "@/lib/sprint-plan";
import { taskErrorCopy, type Task } from "@/types/task";

/**
 * Dragging on the planning screen: a task into a sprint, back to the backlog,
 * between sprints, or to a new rank inside any of them — all one gesture.
 *
 * Same shape as the backlog's `use-task-status-dnd.ts`, with the CONTAINER
 * being a sprint instead of a status: one `PATCH /tasks/:id/move` naming the
 * new `sprintId` (null for the backlog) and the neighbours it landed between
 * (`lib/task-rank.ts`). Optimistic through `useOptimistic`; the action's
 * revalidate replaces the copy with the server's list, so a refused move slides
 * back on its own and a toast says why.
 *
 * Rows win over containers when the pointer is inside both, because a row
 * carries a position and a container only means "at the end".
 */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length === 0) return closestCenter(args);
  const rows = hits.filter((hit) => !String(hit.id).startsWith("container:"));
  return rows.length > 0 ? rows : hits;
};

type Move = { taskId: string; sprintId: ContainerId; position: number };

export function usePlanningDnd({
  tasks,
  scope,
  visible,
}: {
  tasks: Task[];
  scope: TaskScope;
  visible: (task: Task) => boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [shown, move] = useOptimistic(tasks, (current, next: Move) =>
    current
      .map((task) => {
        if (task.id !== next.taskId) return task;
        const sprint = scope.sprints.find((entry) => entry.id === next.sprintId);
        return {
          ...task,
          position: next.position,
          sprintId: next.sprintId,
          sprint: sprint ? { id: sprint.id, name: sprint.name, state: sprint.state } : null,
        };
      })
      .sort(byRank),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);

    const task = shown.find((entry) => entry.id === String(event.active.id));
    const data = event.over?.data.current as { sprintId?: ContainerId } | undefined;
    if (!task || !event.over || !data || data.sprintId === undefined) return;

    const sprintId = data.sprintId;
    const overId = String(event.over.id).startsWith("container:") ? null : String(event.over.id);
    const list = containerTasks(shown, sprintId).filter(visible);
    const target = rankTarget({ list, activeId: task.id, overId, sameList: task.sprintId === sprintId });
    if (!target) return;

    const hasNeighbour = target.afterId !== null || target.beforeId !== null;
    const destination = scope.sprints.find((sprint) => sprint.id === sprintId)?.name ?? "the backlog";

    startTransition(async () => {
      move({ taskId: task.id, sprintId, position: hasNeighbour ? target.position : task.position });

      const result = await moveTaskAction(scope.workspaceId, scope.projectId, task.id, {
        ...(sprintId !== task.sprintId ? { sprintId } : {}),
        afterId: target.afterId,
        beforeId: target.beforeId,
      });

      if (result.code) {
        toast.error(`${task.key} could not move to ${destination}. ${taskErrorCopy(result.code)}`);
      }
    });
  }

  return {
    tasks: shown,
    activeTask: shown.find((task) => task.id === activeId) ?? null,
    dndContextProps: {
      sensors,
      collisionDetection: collision,
      onDragStart: (event: DragStartEvent) => setActiveId(String(event.active.id)),
      onDragEnd,
      onDragCancel: () => setActiveId(null),
    },
  };
}
