"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { datesError, SprintDetailsFields } from "@/components/sprint-planning/sprint-details-fields";
import { SprintDurationChoices } from "@/components/sprint-planning/sprint-duration-choices";
import type { TaskScope } from "@/components/tasks/task-draft";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { startSprintAction } from "@/lib/actions/sprint-actions";
import { endDateFor } from "@/lib/sprint-plan";
import { sprintErrorCopy, type ProjectSprint } from "@/types/project-sprint";

/**
 * Start a sprint — the moment its dates and goal are settled.
 *
 * DURATION BUTTONS SET THE END DATE. Picking "2 weeks" from a start date is how
 * teams think about a sprint; the end date field stays editable for the odd
 * holiday-shortened one, and editing it by hand simply deselects the button.
 * Defaults: the dates already on the sprint, else today and two weeks.
 *
 * The dialog repeats what is being committed to — tasks and points — because
 * starting is the one planning step that changes what the team is working on.
 * The single-active rule is enforced by the API; the header already disables
 * Start while another sprint runs, so a `409` here means a race and says so.
 */
export function StartSprintDialog({
  sprint,
  count,
  points,
  scope,
  onClose,
}: {
  /** `null` while closed. */
  sprint: ProjectSprint | null;
  count: number;
  points: number;
  scope: TaskScope;
  onClose: () => void;
}) {
  const titleId = useId();
  const [isPending, startTransition] = useTransition();
  const startDate = sprint?.startDate ?? scope.today;
  const [dates, setDates] = useState({ startDate, endDate: sprint?.endDate ?? endDateFor(startDate, 2) });
  const [goal, setGoal] = useState(sprint?.goal ?? "");

  function confirm() {
    if (!sprint || !dates.startDate || !dates.endDate || datesError(dates)) return;

    startTransition(async () => {
      const result = await startSprintAction(scope.workspaceId, scope.projectId, sprint.id, {
        ...dates,
        goal: goal.trim() || null,
      });
      if (result.code) {
        toast.error(sprintErrorCopy(result.code));
        return;
      }
      toast.success(result.message);
      onClose();
    });
  }

  return (
    <Dialog open={sprint !== null} onOpenChange={(next) => !next && onClose()} aria-labelledby={titleId} className="max-w-lg">
      <DialogContent>
        <DialogHeader>
          <DialogTitle id={titleId}>Start {sprint?.name}</DialogTitle>
          <DialogDescription>
            {count === 1 ? "1 task" : `${count} tasks`} · {points} story points will be in this sprint.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <SprintDurationChoices {...dates} fallbackStart={scope.today} onChange={setDates} />
          <SprintDetailsFields dates={dates} goal={goal} today={scope.today} onDates={setDates} onGoal={setGoal} />
        </div>

        <DialogFooter className="mt-5">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isPending || !dates.startDate || !dates.endDate || Boolean(datesError(dates))} onClick={confirm}>
            {isPending ? "Starting…" : "Start sprint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
