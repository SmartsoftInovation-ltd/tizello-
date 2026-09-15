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
import { taskErrorCopy, type Task, type TaskStatusOption } from "@/types/task";

/**
 * Dragging a backlog task: to another spot in its status (RANK), to another
 * status, or both in one drop — the sensors, the landing spot, and the write.
 *
 * OPTIMISTIC, AND IT UNDOES ITSELF. The task moves the instant it is dropped,
 * through `useOptimistic` inside a transition; the write is one
 * `PATCH /tasks/:id/move` naming its new neighbours (`lib/task-rank.ts`). When
 * the action returns, its `revalidatePath` has already delivered the server's
 * list, so the optimistic copy is replaced by the truth — and on a failure that
 * truth is the old spot, so the task slides back with no rollback code of its
 * own. A failed drop still says so, because a task that silently returns reads
 * as a bug.
 *
 * `pointerWithin` first, `closestCenter` as the fallback: sections and rows are
 * stacked, and the pointer is the honest answer to "which one" — the fallback
 * is what keeps the keyboard sensor, which has no pointer, able to land.
 * Rows are preferred over their section when both contain the pointer, because
 * a row carries a position and the section only means "at the end".
 */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length === 0) return closestCenter(args);
  const rows = hits.filter((hit) => !String(hit.id).startsWith("status:"));
  return rows.length > 0 ? rows : hits;
};

type Move = { taskId: string; status: TaskStatusOption; position: number };

export function useTaskStatusDnd({
  tasks,
  scope,
  visible,
}: {
  tasks: Task[];
  scope: TaskScope;
  /** What the board is showing — neighbours are chosen among these, filters applied. */
  visible: (task: Task) => boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [shown, move] = useOptimistic(tasks, (current, next: Move) =>
    current
      .map((task) =>
        task.id === next.taskId
          ? {
              ...task,
              position: next.position,
              statusId: next.status.id,
              status: { id: next.status.id, name: next.status.name, color: next.status.color, group: next.status.group },
            }
          : task,
      )
      .sort(byRank),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);

    const task = shown.find((entry) => entry.id === String(event.active.id));
    const statusId = event.over?.data.current?.statusId as string | undefined;
    const status = scope.statuses.find((entry) => entry.id === statusId);
    if (!task || !status || !event.over) return;

    const overId = String(event.over.id).startsWith("status:") ? null : String(event.over.id);
    const list = shown.filter((entry) => entry.statusId === status.id && !entry.parentId && visible(entry));
    const target = rankTarget({ list, activeId: task.id, overId, sameList: task.statusId === status.id });
    if (!target) return;

    const hasNeighbour = target.afterId !== null || target.beforeId !== null;

    startTransition(async () => {
      move({ taskId: task.id, status, position: hasNeighbour ? target.position : task.position });

      const result = await moveTaskAction(scope.workspaceId, scope.projectId, task.id, {
        ...(status.id !== task.statusId ? { statusId: status.id } : {}),
        afterId: target.afterId,
        beforeId: target.beforeId,
      });

      if (result.code) {
        toast.error(`${task.key} stayed where it was. ${taskErrorCopy(result.code)}`);
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
