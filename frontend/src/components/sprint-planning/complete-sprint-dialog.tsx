"use client";

import { useId, useTransition } from "react";
import { toast } from "sonner";
import type { TaskScope } from "@/components/tasks/task-draft";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { completeSprintAction, deleteSprintAction } from "@/lib/actions/sprint-actions";
import { sprintErrorCopy, type ProjectSprint } from "@/types/project-sprint";

/**
 * Confirm completing the active sprint, or deleting a planning one — the two
 * sprint operations that return work to the backlog, so one component with the
 * counts spelled out.
 *
 * COMPLETE: tasks in a Complete-group status stay as the sprint's record;
 * everything else returns to the backlog, keeping its comments, history and
 * rank (`backend/docs/api/sprint.md`). DELETE: only for a sprint that never
 * started; all of its tasks return.
 *
 * The dialog closes only once the API has answered, so a refusal lands while
 * the person who pressed the button is still looking.
 */
export function CompleteSprintDialog({
  sprint,
  mode,
  done,
  unfinished,
  scope,
  onClose,
}: {
  /** `null` while closed. */
  sprint: ProjectSprint | null;
  mode: "complete" | "delete";
  done: number;
  unfinished: number;
  scope: TaskScope;
  onClose: () => void;
}) {
  const titleId = useId();
  const [isPending, startTransition] = useTransition();
  const plural = (count: number) => (count === 1 ? "1 task" : `${count} tasks`);

  function confirm() {
    if (!sprint) return;

    startTransition(async () => {
      const act = mode === "complete" ? completeSprintAction : deleteSprintAction;
      const result = await act(scope.workspaceId, scope.projectId, sprint.id);
      if (result.code) {
        toast.error(sprintErrorCopy(result.code));
        return;
      }
      toast.success(result.message);
      onClose();
    });
  }

  const description =
    mode === "complete"
      ? `${plural(done)} done — they stay in this sprint as its record. ${
          unfinished > 0 ? `${plural(unfinished)} not finished will return to the backlog.` : "Nothing is left unfinished."
        }`
      : `${unfinished + done > 0 ? `Its ${plural(unfinished + done)} return to the backlog. ` : ""}The sprint itself is removed.`;

  return (
    <Dialog open={sprint !== null} onOpenChange={(next) => !next && onClose()} aria-labelledby={titleId}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle id={titleId}>
            {mode === "complete" ? "Complete" : "Delete"} {sprint?.name}?
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-5">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={mode === "delete" ? "danger" : "default"} disabled={isPending} onClick={confirm}>
            {isPending ? "Working…" : mode === "complete" ? "Complete sprint" : "Delete sprint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
