"use client";

import { useState } from "react";
import { BacklogEmpty } from "@/components/backlog/backlog-empty";
import { TaskBacklogBoard } from "@/components/tasks/task-backlog-board";
import { TaskBacklogToolbar } from "@/components/tasks/task-backlog-toolbar";
import { TaskDeleteDialog } from "@/components/tasks/task-delete-dialog";
import type { TaskScope } from "@/components/tasks/task-draft";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { TaskStatusEditor } from "@/components/tasks/task-status-editor";
import { listTaskCommentsAction } from "@/lib/actions/task-actions";
import type { Task } from "@/types/task";

/**
 * The interactive half of the backlog: the status sections, the one task
 * drawer every row opens, and the status editor.
 *
 * THE LIST IS A PROP, NEVER STATE. Every write goes through a Server Action
 * that revalidates this route, so the page re-renders with the server's list;
 * the only local copy is the optimistic one a drag holds for the length of its
 * request (`use-task-status-dnd.ts`).
 *
 * THE STATUS EDITOR LIVES HERE, not inside the drawer. It opens from the
 * toolbar and from the drawer's status picker alike, and rendering it inside
 * the drawer's `<form>` would put its inputs — and their Enter key — inside the
 * task's form. As a sibling dialog it opens above the drawer instead.
 */
type Editor = { mode: "create" } | { mode: "edit"; taskId: string };

export function TaskBacklogPanel({ tasks, scope }: { tasks: Task[]; scope: TaskScope }) {
  const [editor, setEditor] = useState<Editor>({ mode: "create" });
  const [open, setOpen] = useState(false);
  const [commentsPromise, setCommentsPromise] =
    useState<ReturnType<typeof listTaskCommentsAction> | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<Task | null>(null);
  const [statusEditor, setStatusEditor] = useState({ open: false, key: 0 });

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

  /* Remounted on every open, so the editor starts from the statuses as they
     are NOW rather than as they were the last time it closed. */
  const editStatuses = scope.canManageProperties
    ? () => setStatusEditor((current) => ({ open: true, key: current.key + 1 }))
    : undefined;

  const ids = new Set(tasks.map((task) => task.id));
  const topLevelCount = tasks.filter((task) => !task.parentId || !ids.has(task.parentId)).length;

  return (
    <section>
      <TaskBacklogToolbar
        count={topLevelCount}
        subtaskCount={tasks.length - topLevelCount}
        canCreate={scope.canContribute}
        onNewTask={openCreate}
        onEditStatuses={editStatuses}
      />

      {tasks.length === 0 ? (
        <div className="mt-4">
          <BacklogEmpty />
        </div>
      ) : (
        <TaskBacklogBoard
          tasks={tasks}
          scope={scope}
          onOpen={openTask}
          onDelete={scope.canContribute ? setPendingDeletion : undefined}
        />
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
