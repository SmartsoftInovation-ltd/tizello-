"use client";

import { PropertyRow } from "@/components/projects/property-row";
import type { TaskDraft, TaskScope } from "@/components/tasks/task-draft";
import { TaskParentPicker } from "@/components/tasks/task-parent-picker";
import { TaskSubtasks } from "@/components/tasks/task-subtasks";
import type { Task } from "@/types/task";

/**
 * Relations: where this task sits in the tree — its parent above, its
 * sub-tasks below — in one section.
 *
 * Parent used to be a row among the properties while sub-tasks lived down here,
 * so the one hierarchy was split across two places a screen apart.
 *
 * THE TWO HALVES SAVE DIFFERENTLY, and that is kept on purpose. Parent is a
 * field OF this task, so it rides the draft and the drawer's Save like every
 * property. A sub-task is ANOTHER task, so adding one writes immediately
 * (`task-subtasks.tsx` says why). Sub-tasks need a task that exists; the parent
 * picker does not, which is how "add a sub-task" pre-fills it on create.
 */
export function TaskRelations({
  task,
  draft,
  scope,
  tasks,
  onChange,
  onOpenTask,
}: {
  task: Task | null;
  draft: TaskDraft;
  scope: TaskScope;
  tasks: Task[];
  onChange: (patch: Partial<TaskDraft>) => void;
  onOpenTask: (taskId: string) => void;
}) {
  /* A new task has no sub-tasks, so its "section" would be one row under a
     heading and a rule — the parent picker joins the Details list visually
     instead. The heading and rule return once there is a tree to show. */
  return (
    <section
      className={task ? "mt-6 border-t border-border pt-4" : undefined}
      aria-label="Relations"
    >
      {task && <h3 className="px-0.5 text-xs font-medium text-text-subtle">Relations</h3>}

      <div className={task ? "mt-2" : undefined}>
        <PropertyRow label="Parent task" icon="arrow">
          <TaskParentPicker
            taskId={task?.id}
            tasks={tasks}
            value={draft.parentId}
            onChange={(parentId) => onChange({ parentId })}
          />
        </PropertyRow>
      </div>

      {task && <TaskSubtasks task={task} tasks={tasks} scope={scope} onOpenTask={onOpenTask} />}
    </section>
  );
}
