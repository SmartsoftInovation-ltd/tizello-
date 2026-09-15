"use client";

import { useState, type ReactNode } from "react";
import { TaskBacklogBoard } from "@/components/tasks/task-backlog-board";
import { TaskBacklogFilters } from "@/components/tasks/task-backlog-filters";
import { TaskBacklogToolbar } from "@/components/tasks/task-backlog-toolbar";
import { TaskBulkBar } from "@/components/tasks/task-bulk-bar";
import { TaskDeleteDialog } from "@/components/tasks/task-delete-dialog";
import type { TaskScope } from "@/components/tasks/task-draft";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { TaskStatusEditor } from "@/components/tasks/task-status-editor";
import { listTaskCommentsAction } from "@/lib/actions/task-actions";
import { activeFilterCount, matchesFilters, NO_FILTERS, tagsIn, type TaskFilters } from "@/lib/task-filters";
import type { Task } from "@/types/task";

/**
 * The interactive half of the backlog: filters, the status sections, the
 * selection and its bulk bar, the one task drawer every row opens, and the
 * status editor.
 *
 * THE LIST IS A PROP, NEVER STATE. Every write goes through a Server Action
 * that revalidates this route, so the page re-renders with the server's list;
 * the only local copy is the optimistic one a drag holds for the length of its
 * request (`use-task-status-dnd.ts`).
 *
 * THE SELECTION IS IDS, READ THROUGH WHAT IS SHOWN. A task that a filter hides,
 * that was deleted, or that moved out of the To-do group drops out of
 * `selectedIds` without any cleanup code — so a bulk action can only ever touch
 * rows the person can see ticked.
 *
 * THE STATUS EDITOR LIVES HERE, not inside the drawer. It opens from the
 * toolbar and from the drawer's status picker alike, and rendering it inside
 * the drawer's `<form>` would put its inputs — and their Enter key — inside the
 * task's form. As a sibling dialog it opens above the drawer instead.
 */
type Editor = { mode: "create" } | { mode: "edit"; taskId: string };

export function TaskBacklogPanel({
  tasks,
  scope,
  leading,
  actions,
}: {
  tasks: Task[];
  scope: TaskScope;
  /** Toolbar slots — see `TaskBacklogToolbar`. */
  leading?: ReactNode;
  actions?: ReactNode;
}) {
  const [editor, setEditor] = useState<Editor>({ mode: "create" });
  const [open, setOpen] = useState(false);
  const [commentsPromise, setCommentsPromise] =
    useState<ReturnType<typeof listTaskCommentsAction> | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<Task | null>(null);
  const [statusEditor, setStatusEditor] = useState({ open: false, key: 0 });
  const [filters, setFilters] = useState<TaskFilters>(NO_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const editing =
    editor.mode === "edit" ? (tasks.find((task) => task.id === editor.taskId) ?? null) : null;

  function openTask(taskId: string) {
    setEditor({ mode: "edit", taskId });
    setCommentsPromise(listTaskCommentsAction(taskId));
    setOpen(true);
  }

  function openCreate() {
    setEditor({ mode: "create" });
    setCommentsPromise(null);
    setOpen(true);
  }

  function select(taskId: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  }

  /* Remounted on every open, so the editor starts from the statuses as they
     are NOW rather than as they were the last time it closed. */
  const editStatuses = scope.canManageProperties
    ? () => setStatusEditor((current) => ({ open: true, key: current.key + 1 }))
    : undefined;

  /* The toolbar count, the selection and "select all" all follow what the
     board actually shows — top-level TODO-group tasks that pass the filters. */
  const todoStatusIds = new Set(
    scope.statuses.filter((status) => status.group === "TODO").map((status) => status.id),
  );
  const todoTasks = tasks.filter((task) => todoStatusIds.has(task.statusId));
  const ids = new Set(todoTasks.map((task) => task.id));
  const topLevel = todoTasks.filter((task) => !task.parentId || !ids.has(task.parentId));
  const visible = (task: Task) => matchesFilters(task, filters);
  const shown = topLevel.filter(visible);
  const selectedIds = shown.filter((task) => selected.has(task.id)).map((task) => task.id);
  const filtered = activeFilterCount(filters) > 0;

  return (
    <section>
      <TaskBacklogToolbar
        count={topLevel.length}
        subtaskCount={todoTasks.length - topLevel.length}
        canCreate={scope.canContribute}
        onNewTask={openCreate}
        onEditStatuses={editStatuses}
        leading={leading}
        actions={actions}
      />

      <div className="flex flex-wrap items-end justify-between gap-2">
        <TaskBacklogFilters filters={filters} tags={tagsIn(tasks)} scope={scope} onChange={setFilters} />
        <p className="text-2xs text-text-subtle">
          {filtered && `${shown.length} of ${topLevel.length} shown`}
          {scope.canContribute && shown.length > 0 && selectedIds.length < shown.length && (
            <button
              type="button"
              onClick={() => setSelected(new Set(shown.map((task) => task.id)))}
              className="ml-2 rounded-xs px-1 font-medium text-text-muted underline-offset-2 hover:text-text hover:underline"
            >
              Select all {shown.length}
            </button>
          )}
        </p>
      </div>

      <TaskBacklogBoard
        tasks={tasks}
        scope={scope}
        visible={visible}
        filtered={filtered}
        selected={selected}
        onOpen={openTask}
        onDelete={scope.canContribute ? setPendingDeletion : undefined}
        onSelect={scope.canContribute ? select : undefined}
      />

      {selectedIds.length > 0 && (
        <TaskBulkBar selectedIds={selectedIds} scope={scope} onClear={() => setSelected(new Set())} />
      )}

      <TaskDeleteDialog task={pendingDeletion} scope={scope} onClose={() => setPendingDeletion(null)} />

      <TaskDrawer
        /* A task deleted while its drawer was open has nothing left to show. */
        open={open && (editor.mode === "create" || editing !== null)}
        task={editing}
        scope={scope}
        tasks={tasks}
        commentsPromise={commentsPromise}
        onOpenChange={setOpen}
        onOpenTask={openTask}
      />

      {editStatuses && (
        <TaskStatusEditor
          key={statusEditor.key}
          open={statusEditor.open}
          scope={scope}
          onOpenChange={(next) => setStatusEditor((current) => ({ ...current, open: next }))}
        />
      )}
    </section>
  );
}
