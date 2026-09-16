"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  closestCenter,
  KeyboardSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { RowPointerSensor } from "@/components/tasks/row-pointer-sensor";
import type { TaskScope } from "@/components/tasks/task-draft";
import { moveTaskAction } from "@/lib/actions/task-bulk-actions";
import { columnTasks } from "@/lib/current-sprint";
import { byRank } from "@/lib/task-filters";
import { rankTarget } from "@/lib/task-rank";
import { taskErrorCopy, type Task } from "@/types/task";

/**
 * Dragging on the current sprint board: a card into another status column, or
 * to a new rank inside its own — one gesture, one `PATCH /tasks/:id/move`
 * naming the new `statusId` and the neighbours it landed between.
 *
 * The same shape as sprint planning's `use-planning-dnd.ts`, with the column
 * being a STATUS instead of a sprint. Optimistic through `useOptimistic`; the
 * action's revalidate replaces the copy with the server's list, so a refused
 * move slides back on its own and a toast says why. The server also restamps
 * `completedAt` when a card crosses into or out of a Complete-group column.
 *
 * Cards win over columns when the pointer is inside both, because a card
 * carries a position and a column only means "at the end".
 */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length === 0) return closestCenter(args);
  const cards = hits.filter((hit) => !String(hit.id).startsWith("column:"));
  return cards.length > 0 ? cards : hits;
};

type Move = { taskId: string; statusId: string; position: number };

export function useSprintBoardDnd({
  tasks,
  scope,
  visible,
}: {
  /** The sprint's cards only. */
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
        const status = scope.statuses.find((entry) => entry.id === next.statusId);
        return {
          ...task,
          position: next.position,
          statusId: next.statusId,
          status: status ? { id: status.id, name: status.name, color: status.color, group: status.group } : task.status,
        };
      })
      .sort(byRank),
  );

  const sensors = useSensors(
    /* Whole-card drag (`row-pointer-sensor.ts`); 6px of movement is what keeps a click a click. */
    useSensor(RowPointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);

    const task = shown.find((entry) => entry.id === String(event.active.id));
    const data = event.over?.data.current as { statusId?: string } | undefined;
    if (!task || !event.over || !data?.statusId) return;

    const statusId = data.statusId;
    const overId = String(event.over.id).startsWith("column:") ? null : String(event.over.id);
    const list = columnTasks(shown, statusId).filter(visible);
    const target = rankTarget({ list, activeId: task.id, overId, sameList: task.statusId === statusId });
    if (!target) return;

    const hasNeighbour = target.afterId !== null || target.beforeId !== null;
    const destination = scope.statuses.find((status) => status.id === statusId)?.name ?? "that column";

    startTransition(async () => {
      move({ taskId: task.id, statusId, position: hasNeighbour ? target.position : task.position });

      const result = await moveTaskAction(scope.workspaceId, scope.projectId, task.id, {
        ...(statusId !== task.statusId ? { statusId } : {}),
        afterId: target.afterId,
        beforeId: target.beforeId,
      });

      if (result.code) toast.error(`${task.key} could not move to ${destination}. ${taskErrorCopy(result.code)}`);
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
