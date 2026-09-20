import { SprintBoardCard } from "@/components/current-sprint/sprint-board-card";
import { TaskStatusChip } from "@/components/tasks/task-status-chip";
import type { Task, TaskStatusOption } from "@/types/task";

/**
 * A column as it looks while carried: its header and the first few cards,
 * tilted and raised. Capped at three cards so a long column does not drag a
 * wall of content across the rail — the point is to recognise which column is
 * in hand, not to read it.
 */
export function ColumnDragPreview({ status, tasks, today }: { status: TaskStatusOption; tasks: Task[]; today: string }) {
  return (
    <div className="w-list rotate-1 scale-[1.02] cursor-grabbing rounded-lg border border-brand-500/50 bg-panel p-2 shadow-raised ring-4 ring-brand-500/15">
      <div className="flex items-center gap-2 px-0.5 pb-2">
        <TaskStatusChip status={status} />
        <span className="rounded-full bg-surface-hover px-1.5 text-2xs font-semibold text-text-muted tabular-nums">{tasks.length}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {tasks.slice(0, 3).map((task) => (
          <SprintBoardCard key={task.id} task={task} today={today} onOpen={() => {}} lifted />
        ))}
        {tasks.length > 3 && <p className="px-1 text-2xs text-text-subtle">+{tasks.length - 3} more</p>}
      </div>
    </div>
  );
}
