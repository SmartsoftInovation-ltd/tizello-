"use client";

import { useId, useTransition } from "react";
import { toast } from "sonner";
import type { TaskScope } from "@/components/tasks/task-draft";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteTaskAction } from "@/lib/actions/task-actions";
import { taskErrorCopy, type Task } from "@/types/task";

/**
 * Confirm, then delete a task.
 *
 * No type-to-confirm, unlike a project: a task is one row, not a container of
 * other people's work, and a gate that heavy on something people delete
 * several times a day trains them to paste through it. The copy says what
 * actually happens to sub-tasks — they are kept and move up to the top level —
 * because "and everything in it" would be untrue here.
 *
 * The dialog closes only once the API has answered, so a `403` lands while the
 * person who pressed Delete is still looking at it.
 */
export function TaskDeleteDialog({
  task,
  scope,
  onClose,
}: {
  /** `null` while closed. */
  task: Task | null;
  scope: TaskScope;
  onClose: () => void;
}) {
  const titleId = useId();
  const [isPending, startTransition] = useTransition();

  function confirm() {
    if (!task) return;

    startTransition(async () => {
      const result = await deleteTaskAction(scope.workspaceId, scope.projectId, task.id);
      if (result.code) {
        toast.error(taskErrorCopy(result.code));
        return;
      }
      toast.success(`${task.key} deleted.`);
      onClose();
    });
  }

  return (
    <Dialog open={task !== null} onOpenChange={(open) => !open && onClose()} aria-labelledby={titleId}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle id={titleId}>Delete {task?.key}?</DialogTitle>
          <DialogDescription>
            &ldquo;{task?.title}&rdquo; and its comments go away permanently.
            {task && task.subtaskCount > 0
              ? " Its sub-tasks are kept and move to the top of the backlog."
              : ""}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-5">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={isPending} onClick={confirm}>
            {isPending ? "Deleting…" : "Delete task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
