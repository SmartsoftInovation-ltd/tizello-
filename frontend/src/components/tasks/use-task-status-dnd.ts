"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import type { TaskScope } from "@/components/tasks/task-draft";
import { updateTaskAction } from "@/lib/actions/task-actions";
import { taskErrorCopy, type Task, type TaskStatusOption } from "@/types/task";

/**
 * Dragging a task onto another status: the sensors, the drop, and the write.
 *
 * OPTIMISTIC, AND IT UNDOES ITSELF. The task moves the instant it is dropped,
 * through `useOptimistic` inside a transition; the write is a `PATCH` with the
 * new `statusId`. When the action returns, its `revalidatePath` has already
 * delivered the server's list, so the optimistic copy is simply replaced by
 * the truth — and on a failure that truth is the old status, so the task slides
 * back with no rollback code of its own. A failed drop still says so, because
 * a task that silently returns reads as a bug.
 *
 * `pointerWithin` first, rectangles as the fallback: sections are tall and
 * stacked, and the pointer is the honest answer to "which one" — the fallback
 * is what keeps the keyboard sensor, which has no pointer, able to land.
 */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

export function useTaskStatusDnd({ tasks, scope }: { tasks: Task[]; scope: TaskScope }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [shown, move] = useOptimistic(
    tasks,
    (current, next: { taskId: string; status: TaskStatusOption }) =>
      current.map((task) =>
        task.id === next.taskId
          ? {
              ...task,
              statusId: next.status.id,
              status: {
                id: next.status.id,
                name: next.status.name,
                color: next.status.color,
                group: next.status.group,
              },
            }
          : task,
      ),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);

    const task = shown.find((entry) => entry.id === String(event.active.id));
    const statusId = event.over?.data.current?.statusId as string | undefined;
    const status = scope.statuses.find((entry) => entry.id === statusId);
    if (!task || !status || task.statusId === status.id) return;

    startTransition(async () => {
      move({ taskId: task.id, status });

      const result = await updateTaskAction(scope.workspaceId, scope.projectId, task.id, {
        statusId: status.id,
      });

      if (result.code || result.fieldErrors) {
        toast.error(`${task.key} stayed in ${task.status.name}. ${taskErrorCopy(result.code ?? "VALIDATION_ERROR")}`);
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
