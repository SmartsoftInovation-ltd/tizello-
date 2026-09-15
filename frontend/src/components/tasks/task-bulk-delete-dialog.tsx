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
import { bulkDeleteTasksAction } from "@/lib/actions/task-bulk-actions";
import { taskErrorCopy } from "@/types/task";

/**
 * Confirm, then delete every selected task — the many-row twin of
 * `task-delete-dialog.tsx`, with the same copy about sub-tasks and the same
 * rule that the dialog closes only once the API has answered.
 *
 * Still no type-to-confirm: the count is in the title, and one request deletes
 * the whole selection or none of it.
 */
export function TaskBulkDeleteDialog({
  open,
  taskIds,
  scope,
  onClose,
  onDeleted,
}: {
  open: boolean;
  taskIds: string[];
  scope: TaskScope;
  onClose: () => void;
  /** Clears the selection — the ids it held no longer exist. */
  onDeleted: () => void;
}) {
  const titleId = useId();
  const [isPending, startTransition] = useTransition();
  const count = taskIds.length;
  const noun = count === 1 ? "task" : "tasks";

  function confirm() {
    startTransition(async () => {
      const result = await bulkDeleteTasksAction(scope.workspaceId, scope.projectId, taskIds);
      if (result.code) {
        toast.error(taskErrorCopy(result.code));
        return;
      }
      toast.success(`${count} ${noun} deleted.`);
      onClose();
      onDeleted();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()} aria-labelledby={titleId}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle id={titleId}>
            Delete {count} {noun}?
          </DialogTitle>
          <DialogDescription>
            They and their comments go away permanently. Any sub-tasks that are not selected are kept
            and move to the top of the backlog.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-5">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={isPending} onClick={confirm}>
            {isPending ? "Deleting…" : `Delete ${count} ${noun}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
