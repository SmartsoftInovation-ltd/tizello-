"use client";

import { CompleteSprintDialog } from "@/components/sprint-planning/complete-sprint-dialog";
import { SprintDrawer } from "@/components/sprint-planning/sprint-drawer";
import { StartSprintDialog } from "@/components/sprint-planning/start-sprint-dialog";
import type { SprintDialog } from "@/components/sprint-planning/use-sprint-dialogs";
import type { TaskScope } from "@/components/tasks/task-draft";
import { containerTasks, pointsByGroup } from "@/lib/sprint-plan";
import type { Task } from "@/types/task";

/**
 * Every sprint surface the planning screen can open — the create/edit drawer and
 * the start, complete and delete confirms — rendered from one state
 * (`use-sprint-dialogs.ts`). The counts each confirm shows are computed here
 * from the same task list the boxes draw, so a dialog cannot quote a number
 * the screen behind it disagrees with.
 */
export function SprintDialogs({
  dialog,
  dialogKey,
  tasks,
  scope,
  onClose,
}: {
  dialog: SprintDialog;
  dialogKey: number;
  tasks: Task[];
  scope: TaskScope;
  onClose: () => void;
}) {
  const sprint = dialog.kind === "none" ? null : dialog.sprint;
  const inSprint = sprint ? containerTasks(tasks, sprint.id) : [];
  const done = inSprint.filter((task) => task.status.group === "COMPLETE").length;

  return (
    <>
      <SprintDrawer
        open={dialog.kind === "form"}
        formKey={dialogKey}
        sprint={dialog.kind === "form" ? dialog.sprint : null}
        count={inSprint.length}
        points={pointsByGroup(inSprint)}
        scope={scope}
        onClose={onClose}
      />
      <StartSprintDialog
        key={`start-${dialogKey}`}
        sprint={dialog.kind === "start" ? dialog.sprint : null}
        count={inSprint.length}
        points={pointsByGroup(inSprint).total}
        scope={scope}
        onClose={onClose}
      />
      <CompleteSprintDialog
        sprint={dialog.kind === "complete" || dialog.kind === "delete" ? dialog.sprint : null}
        mode={dialog.kind === "delete" ? "delete" : "complete"}
        done={done}
        unfinished={inSprint.length - done}
        scope={scope}
        onClose={onClose}
      />
    </>
  );
}
