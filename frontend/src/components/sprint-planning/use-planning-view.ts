"use client";

import { useState } from "react";
import { listTaskCommentsAction } from "@/lib/actions/task-actions";
import { NO_FILTERS, type TaskFilters } from "@/lib/task-filters";
import type { Task } from "@/types/task";

/**
 * The planning screen's local view state: filters, the selection, which boxes
 * are collapsed, the one task drawer every row and "New task" opens, and the
 * task pending deletion.
 *
 * Separate from the board component for the line cap, and because none of it
 * is data — the task list stays a prop, refreshed by each action's revalidate.
 */
export function usePlanningView() {
  const [filters, setFilters] = useState<TaskFilters>(NO_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [collapsed, setCollapsed] = useState<string[]>([]);
  /* `taskId: null` creates; `sprintId` seeds the new task's sprint. `key`
     remounts the create form per open, so a second "New task" starts blank. */
  const [drawer, setDrawer] = useState<{ open: boolean; taskId: string | null; sprintId?: string; key: number }>({
    open: false,
    taskId: null,
    key: 0,
  });
  const [pendingDeletion, setPendingDeletion] = useState<Task | null>(null);
  const [commentsPromise, setCommentsPromise] = useState<ReturnType<typeof listTaskCommentsAction> | null>(null);

  function openTask(taskId: string) {
    setDrawer((current) => ({ open: true, taskId, key: current.key }));
    setCommentsPromise(listTaskCommentsAction(taskId));
  }

  function openCreate(sprintId?: string) {
    setDrawer((current) => ({ open: true, taskId: null, sprintId, key: current.key + 1 }));
    setCommentsPromise(null);
  }

  function select(taskId: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  }

  function toggle(key: string) {
    setCollapsed((current) => (current.includes(key) ? current.filter((id) => id !== key) : [...current, key]));
  }

  return {
    filters,
    setFilters,
    selected,
    select,
    clearSelection: () => setSelected(new Set()),
    isCollapsed: (key: string) => collapsed.includes(key),
    toggle,
    drawer,
    commentsPromise,
    openTask,
    openCreate,
    pendingDeletion,
    setPendingDeletion,
    setDrawerOpen: (open: boolean) => setDrawer((current) => ({ ...current, open })),
  };
}
