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
  return (
    <section className="mt-6 border-t border-border pt-4" aria-label="Relations">
      <h3 className="px-0.5 text-xs font-medium text-text-subtle">Relations</h3>

      <div className="mt-2">
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
