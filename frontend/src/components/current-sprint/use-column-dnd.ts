"use client";

import { useOptimistic, useState, useTransition } from "react";
import { closestCenter, type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import type { useSprintBoardDnd } from "@/components/current-sprint/use-sprint-board-dnd";
import type { TaskScope } from "@/components/tasks/task-draft";
import { reorderTaskStatusesAction } from "@/lib/actions/task-status-actions";
import { boardColumns } from "@/lib/current-sprint";
import { applyOrder } from "@/lib/task-status-order";
import { TASK_STATUS_GROUP_LABEL, TASK_STATUS_GROUPS, taskErrorCopy, type TaskStatusOption } from "@/types/task";

/**
 * Picking up a whole COLUMN and dropping it somewhere else on the rail — which
 * is reordering the project's statuses, the same `PUT .../task-statuses/order`
 * the status editor sends.
 *
 * THE GROUP FOLLOWS THE SPOT. Columns are drawn group by group (To-do, then In
 * Progress, then Complete), so a column dropped among another group's columns
 * joins that group: "Review" dragged between "In progress" and "Done" is In
 * Progress. A column that stays inside its own group's run keeps its group. A
 * toast says so whenever the group changes, because a group is what decides
 * whether a card in that column counts as finished.
 *
 * Composes with the card hook rather than living inside it: one `DndContext`,
 * and every event is routed by `data.type` — a column drag never touches the
 * card draft, and a card drag never reorders columns. Optimistic through
 * `useOptimistic`; the action's revalidate brings the server's order back.
 */
const rank = (group: TaskStatusOption["group"]) => TASK_STATUS_GROUPS.indexOf(group);
const isColumn = (data: unknown) => (data as { type?: string } | undefined)?.type === "column";

export function useColumnDnd({ scope, cards }: { scope: TaskScope; cards: ReturnType<typeof useSprintBoardDnd> }) {
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [columns, setColumns] = useOptimistic(boardColumns(scope.statuses));
  const card = cards.dndContextProps;

  function reorder(activeId: string, overId: string) {
    const from = columns.findIndex((column) => column.id === activeId);
    const to = columns.findIndex((column) => column.id === overId);
    if (from < 0 || to < 0 || from === to) return;

    const moved = arrayMove(columns, from, to);
    const self = moved[to];
    const left = moved[to - 1];
    const right = moved[to + 1];
    const fits = (!left || rank(left.group) <= rank(self.group)) && (!right || rank(self.group) <= rank(right.group));
    const group = fits ? self.group : (left?.group ?? right.group);
    const order = moved.map((column) => ({ id: column.id, group: column.id === self.id ? group : column.group }));

    startTransition(async () => {
      setColumns(applyOrder(moved, order));
      const result = await reorderTaskStatusesAction(scope.workspaceId, scope.projectId, order);
      if (result.code) toast.error(`Couldn't move the ${self.name} column. ${taskErrorCopy(result.code)}`);
      else if (group !== self.group) toast.success(`${self.name} is now in ${TASK_STATUS_GROUP_LABEL[group]}`);
    });
  }

  const collisionDetection: CollisionDetection = (args) =>
    isColumn(args.active.data.current)
      ? closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter((container) => isColumn(container.data.current)),
        })
      : card.collisionDetection(args);

  return {
    columns,
    activeColumn: columns.find((column) => column.id === activeColumnId) ?? null,
    dndContextProps: {
      sensors: card.sensors,
      collisionDetection,
      onDragStart: (event: DragStartEvent) =>
        isColumn(event.active.data.current)
          ? setActiveColumnId((event.active.data.current as { statusId: string }).statusId)
          : card.onDragStart(event),
      onDragOver: (event: DragOverEvent) => (isColumn(event.active.data.current) ? undefined : card.onDragOver(event)),
      onDragEnd: (event: DragEndEvent) => {
        if (!isColumn(event.active.data.current)) return card.onDragEnd(event);
        setActiveColumnId(null);
        const overStatus = (event.over?.data.current as { statusId?: string } | undefined)?.statusId;
        const activeStatus = (event.active.data.current as { statusId: string }).statusId;
        if (overStatus) reorder(activeStatus, overStatus);
      },
      onDragCancel: () => {
        setActiveColumnId(null);
        card.onDragCancel();
      },
    },
  };
}
