"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { TaskStatusGroupHeader } from "@/components/tasks/task-status-group-header";
import { SortableStatusRow } from "@/components/tasks/sortable-status-row";
import { fromEntries, toEntries } from "@/lib/task-status-order";
import type { StatusColor, TaskStatusGroup, TaskStatusOption } from "@/types/task";

/**
 * The editor's list: the three group headers with their statuses between them,
 * as one sortable list (see `lib/task-status-order.ts` for why one list).
 *
 * A drop is one `PUT` of the whole order. Dropping above the first header —
 * the only position with no group above it — is clamped to just below it, so
 * a status can never land outside every group.
 */
export function TaskStatusOrderList({
  statuses,
  pending,
  onReorder,
  onCreate,
  onOpen,
}: {
  statuses: TaskStatusOption[];
  pending: boolean;
  onReorder: (order: { id: string; group: TaskStatusGroup }[]) => void;
  onCreate: (group: TaskStatusGroup, name: string, color: StatusColor) => void;
  onOpen: (statusId: string) => void;
}) {
  const [adding, setAdding] = useState<TaskStatusGroup | null>(null);
  const entries = toEntries(statuses);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;

    const from = entries.findIndex((entry) => entry.id === active.id);
    const to = Math.max(1, entries.findIndex((entry) => entry.id === over.id));
    if (from < 0) return;

    const next = arrayMove(entries, from, to);
    const order = fromEntries(next);

    /* A drop that changed nothing — same order, same groups — sends nothing. */
    const unchanged = order.every(
      (item, index) => statuses[index]?.id === item.id && statuses[index]?.group === item.group,
    );
    if (!unchanged) onReorder(order);
  }

  return (
    <DndContext id="task-status-order" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={entries.map((entry) => entry.id)} strategy={verticalListSortingStrategy}>
        <ul className="mt-2 max-h-[60dvh] overflow-y-auto">
          {entries.map((entry) =>
            entry.kind === "group" ? (
              <TaskStatusGroupHeader
                key={entry.id}
                id={entry.id}
                group={entry.group}
                adding={adding === entry.group}
                pending={pending}
                onStartAdding={() => setAdding(entry.group)}
                onAdd={(name, color) => {
                  onCreate(entry.group, name, color);
                  setAdding(null);
                }}
                onCancelAdding={() => setAdding(null)}
              />
            ) : (
              <SortableStatusRow
                key={entry.id}
                status={entry.status}
                onOpen={() => onOpen(entry.id)}
              />
            ),
          )}
        </ul>
      </SortableContext>

      <p className="px-1 pt-2 text-2xs text-text-subtle">
        Drag the handle to reorder a status or move it to another group.
      </p>
    </DndContext>
  );
}
