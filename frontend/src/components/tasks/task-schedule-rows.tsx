"use client";

import { FilesValueField } from "@/components/projects/files-value-field";
import { PropertyRow } from "@/components/projects/property-row";
import type { TaskRow } from "@/components/tasks/task-builtin-rows";
import type { TaskDraft, TaskScope } from "@/components/tasks/task-draft";
import { TaskParentPicker } from "@/components/tasks/task-parent-picker";
import { cn } from "@/lib/cn";
import { describeDelay, taskDelayDays } from "@/lib/task-delay";
import type { UploadedFile } from "@/types/project-property";
import type { Task } from "@/types/task";

/**
 * The second half of the task's own fields: Files & media, Delay and
 * Parent-task — what a task is attached to and how it stands against its due
 * date.
 *
 * Split from `task-builtin-rows.tsx` for the 150-line cap, along the one seam
 * the list has: those rows describe the work, these describe its outcome and
 * its place in the tree.
 *
 * DELAY IS READ-ONLY, derived from Due and `completedAt`
 * (`lib/task-delay.ts`). There is deliberately no Completed-on row to edit:
 * the backlog only ever shows TODO-group tasks (`task-backlog-board.tsx`),
 * and `completedAt` is cleared the moment a task leaves a COMPLETE status
 * (`types/task.ts`) — so from here it is always null, the same
 * always-one-value problem that got the Sprint row removed. `complete` still
 * has to be read from the status, though: it is what tells `describeDelay`
 * a task due today finished on time rather than reading as overdue.
 */
export function taskScheduleRows({
  task,
  draft,
  scope,
  tasks,
  onChange,
}: {
  task: Task | null;
  draft: TaskDraft;
  scope: TaskScope;
  tasks: Task[];
  onChange: (patch: Partial<TaskDraft>) => void;
}): TaskRow[] {
  /* The GROUP decides "finished", not a status name — "QA passed" and "Done"
     are both complete if the project put them there. */
  const complete =
    scope.statuses.find((status) => status.id === draft.statusId)?.group === "COMPLETE";
  const delay = taskDelayDays({
    dueDate: draft.dueDate,
    completedAt: draft.completedAt,
    today: scope.today,
  });
  const delayText = describeDelay(delay, complete);
  const delayTone =
    delay !== null && delay > 0 ? "text-danger" : delayText ? "text-text-muted" : "text-text-subtle";

  return [
    {
      key: "files",
      empty: draft.attachments.length === 0,
      node: (
        <PropertyRow label="Files & media" icon="files">
          <FilesValueField
            value={draft.attachments}
            onChange={(value) => onChange({ attachments: value as UploadedFile[] })}
          />
        </PropertyRow>
      ),
    },
    {
      key: "delay",
      empty: !delayText,
      node: (
        <PropertyRow label="Delay" icon="clock">
          <p className={cn("px-2.5 py-2 text-sm", delayTone)}>{delayText || "Set a due date to track delay"}</p>
        </PropertyRow>
      ),
    },
    {
      key: "parent",
      empty: !draft.parentId,
      node: (
        <PropertyRow label="Parent-task" icon="arrow">
          <TaskParentPicker
            taskId={task?.id}
            tasks={tasks}
            value={draft.parentId}
            onChange={(parentId) => onChange({ parentId })}
          />
        </PropertyRow>
      ),
    },
  ];
}
