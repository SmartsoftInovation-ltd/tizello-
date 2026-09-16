"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import {
  closestCorners,
  KeyboardSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { RowPointerSensor } from "@/components/tasks/row-pointer-sensor";
import type { TaskScope } from "@/components/tasks/task-draft";
import { moveTaskAction } from "@/lib/actions/task-bulk-actions";
import { columnTasks } from "@/lib/current-sprint";
import { byRank } from "@/lib/task-filters";
import { taskErrorCopy, type Task } from "@/types/task";

/**
 * Dragging on the current sprint board: a card into another status column, or
 * to a new rank inside its own — one `PATCH /tasks/:id/move` on drop, naming
 * the new `statusId` and the neighbours it landed between.
 *
 * THE CARD CHANGES COLUMNS WHILE IT IS HELD. `onDragOver` moves it into the
 * column under the pointer in a local DRAFT of the list, so that column's
 * sortable context opens a gap for it immediately — the "magnet" slot the card
 * snaps into on release — instead of the column looking untouched until the
 * drop. Within one column, dnd-kit's own transforms already do this.
 *
 * On drop the draft's order IS the answer: the neighbours come from where the
 * card sits in it, the draft is discarded, and the move goes through
 * `useOptimistic` so the card stays put while the request runs. The action's
 * revalidate brings the server's list back; a refused move slides back and a
 * toast says why. Escape or a drop outside any column restores the original.
 *
 * Cards win over columns when the pointer is inside both; outside everything,
 * the closest corner decides, which is what keeps a fast drag across a gap
 * between columns from dropping the target.
 */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length === 0) return closestCorners(args);
  const cards = hits.filter((hit) => !String(hit.id).startsWith("column:"));
  return cards.length > 0 ? cards : hits;
};

const STEP = 1024;

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
  const [draft, setDraft] = useState<Task[] | null>(null);
  const origin = useRef<{ statusId: string; afterId: string | null; beforeId: string | null } | null>(null);
  const [, startTransition] = useTransition();
  const [shown, move] = useOptimistic(tasks, (current, next: Move) =>
    current.map((task) => (task.id === next.taskId ? withStatus(task, next.statusId, next.position) : task)).sort(byRank),
  );

  function withStatus(task: Task, statusId: string, position = task.position): Task {
    const status = scope.statuses.find((entry) => entry.id === statusId);
    return {
      ...task,
      position,
      statusId,
      status: status ? { id: status.id, name: status.name, color: status.color, group: status.group } : task.status,
    };
  }

  function neighbours(list: Task[], taskId: string) {
    const column = list.filter((task) => task.id === taskId || visible(task));
    const index = column.findIndex((task) => task.id === taskId);
    return { after: column[index - 1] ?? null, before: column[index + 1] ?? null };
  }

  const sensors = useSensors(
    /* Whole-card drag (`row-pointer-sensor.ts`); 6px of movement is what keeps a click a click. */
    useSensor(RowPointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    const task = shown.find((entry) => entry.id === id);
    if (!task) return;

    const { after, before } = neighbours(columnTasks(shown, task.statusId), id);
    origin.current = { statusId: task.statusId, afterId: after?.id ?? null, beforeId: before?.id ?? null };
    setActiveId(id);
    setDraft(shown);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    const statusId = (over?.data.current as { statusId?: string } | undefined)?.statusId;
    if (!draft || !over || !statusId) return;

    const task = draft.find((entry) => entry.id === String(active.id));
    if (!task || task.statusId === statusId) return;

    const rest = draft.filter((entry) => entry.id !== task.id);
    const overIndex = rest.findIndex((entry) => entry.id === String(over.id));
    const lastInColumn = rest.findLastIndex((entry) => entry.statusId === statusId);
    const index = overIndex >= 0 ? overIndex : lastInColumn >= 0 ? lastInColumn + 1 : rest.length;

    setDraft([...rest.slice(0, index), withStatus(task, statusId), ...rest.slice(index)]);
  }

  function reset() {
    setActiveId(null);
    setDraft(null);
    origin.current = null;
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const start = origin.current;
    let list = draft;
    reset();

    const taskId = String(active.id);
    const task = list?.find((entry) => entry.id === taskId);
    if (!list || !task || !over || !start) return;

    /* A drop on another card in the same column takes that card's place. */
    const overIndex = list.findIndex((entry) => entry.id === String(over.id));
    if (overIndex >= 0 && list[overIndex].statusId === task.statusId && over.id !== active.id) {
      list = arrayMove(list, list.indexOf(task), overIndex);
    }

    const { after, before } = neighbours(columnTasks(list, task.statusId), taskId);
    const statusChanged = task.statusId !== start.statusId;
    if (!statusChanged && (after?.id ?? null) === start.afterId && (before?.id ?? null) === start.beforeId) return;

    const position =
      after && before ? (after.position + before.position) / 2
      : after ? after.position + STEP
      : before ? before.position - STEP
      : task.position;
    const destination = scope.statuses.find((status) => status.id === task.statusId)?.name ?? "that column";
    const original = tasks.find((entry) => entry.id === taskId);

    startTransition(async () => {
      move({ taskId, statusId: task.statusId, position });

      const result = await moveTaskAction(scope.workspaceId, scope.projectId, taskId, {
        ...(statusChanged ? { statusId: task.statusId } : {}),
        afterId: after?.id ?? null,
        beforeId: before?.id ?? null,
      });

      if (result.code) toast.error(`${original?.key ?? "The task"} could not move to ${destination}. ${taskErrorCopy(result.code)}`);
    });
  }

  const list = draft ?? shown;

  return {
    tasks: list,
    activeTask: list.find((task) => task.id === activeId) ?? null,
    dndContextProps: {
      sensors,
      collisionDetection: collision,
      onDragStart,
      onDragOver,
      onDragEnd,
      onDragCancel: reset,
    },
  };
}
