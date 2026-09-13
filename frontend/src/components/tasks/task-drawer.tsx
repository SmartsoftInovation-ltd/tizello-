"use client";

import { useSyncExternalStore } from "react";
import { TaskForm } from "@/components/tasks/task-form";
import type { TaskScope } from "@/components/tasks/task-draft";
import { Drawer } from "@/components/ui/drawer";
import type { listTaskCommentsAction } from "@/lib/actions/task-actions";
import {
  getSurfaceServerSnapshot,
  readStoredSurface,
  subscribeToSurface,
} from "@/lib/project-surface";
import type { Task } from "@/types/task";

/**
 * A task, in the same panel a project opens in.
 *
 * SIDE PANEL OR CENTRED IS ONE PREFERENCE ACROSS THE APP. It is read from the
 * store `CreateProjectDrawer` and `EditProjectDrawerShell` read, so someone who
 * chose "Centred" for projects gets tasks centred too — a layout that applied
 * to one kind of record would be a setting the user has to find twice. The
 * switch in the header is a class swap on the same `<dialog>`, so flipping it
 * mid-edit keeps every character typed.
 *
 * THE SHELL STAYS MOUNTED, THE FORM DOES NOT. The native `<dialog>` is what
 * hands focus back to the row that opened it, so it must survive the close;
 * the form is remounted by `key` on every open and on every switch between
 * tasks, which is what re-seeds its draft without an effect.
 */
export function TaskDrawer({
  task,
  parentId,
  open,
  scope,
  tasks,
  commentsPromise,
  onOpenChange,
  onOpenTask,
}: {
  /** `null` creates. */
  task: Task | null;
  parentId?: string;
  open: boolean;
  scope: TaskScope;
  /** Every task in the project — the parent picker and the sub-task list read it. */
  tasks: Task[];
  commentsPromise: ReturnType<typeof listTaskCommentsAction> | null;
  onOpenChange: (open: boolean) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const surface = useSyncExternalStore(
    subscribeToSurface,
    readStoredSurface,
    getSurfaceServerSnapshot,
  );

  return (
    <Drawer
      open={open}
      surface={surface}
      onOpenChange={onOpenChange}
      aria-label={task ? `Task ${task.key}` : "New task"}
    >
      <TaskForm
        key={`${task?.id ?? "new"}-${task?.updatedAt ?? ""}-${open}`}
        task={task}
        parentId={parentId}
        scope={scope}
        surface={surface}
        tasks={tasks}
        commentsPromise={commentsPromise}
        onClose={() => onOpenChange(false)}
        onOpenTask={onOpenTask}
      />
    </Drawer>
  );
}
