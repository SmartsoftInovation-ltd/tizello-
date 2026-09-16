import { StoryPointsBadge } from "@/components/backlog/story-points-badge";
import { TaskAssignees } from "@/components/backlog/task-assignees";
import { ProjectPriorityBadge } from "@/components/projects/project-priority-badge";
import { TaskTypeIcon } from "@/components/tasks/task-type-icon";
import { Badge } from "@/components/ui/badge";
import { ChecklistIcon, CommentIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format-date";
import { taskDelayDays } from "@/lib/task-delay";
import type { Task } from "@/types/task";

/**
 * One card on the current sprint board — the task as a column shows it: type
 * and key, the title, then only what is SET (priority, points, due date, tags,
 * sub-task and comment counts), and the assignees on the right.
 *
 * Flat and bordered like every card in this app (DESIGN-SYSTEM.md, "Kanban
 * cards are flat"), with `surface-hover` on hover. No status chip: the column
 * it sits in IS its status. Overdue is amber, not red — late is a fact to
 * notice, not an error.
 *
 * Presentational only, so the drag overlay can draw the same card without a
 * sortable hook (`sortable-sprint-card.tsx` wraps it for the column).
 */
export function SprintBoardCard({
  task,
  today,
  onOpen,
  lifted = false,
}: {
  task: Task;
  today: string;
  onOpen: () => void;
  /** Drawn as the drag overlay — raised, and not a button target. */
  lifted?: boolean;
}) {
  const delay = task.dueDate ? taskDelayDays({ dueDate: task.dueDate, completedAt: task.completedAt ?? "", today }) : null;
  const late = task.status.group !== "COMPLETE" && delay !== null && delay > 0;

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-surface p-2.5 transition-colors duration-100 ease-standard hover:bg-surface-hover",
        lifted && "shadow-raised",
      )}
    >
      <div className="flex items-center gap-1.5">
        <TaskTypeIcon type={task.type} />
        <span className="font-mono text-2xs font-semibold text-text-subtle">{task.key}</span>
      </div>

      <button
        type="button"
        onClick={onOpen}
        tabIndex={lifted ? -1 : undefined}
        className="mt-1 block w-full rounded-xs text-left text-sm font-medium break-words text-text"
      >
        {task.title}
      </button>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 empty:hidden">
        {task.priority && <ProjectPriorityBadge priority={task.priority} />}
        {task.dueDate && (
          <Badge variant={late ? "warning" : "outline"}>
            {late ? "Overdue · " : "Due "}
            {formatDate(task.dueDate)}
          </Badge>
        )}
        {task.tags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2 text-2xs text-text-subtle">
        <StoryPointsBadge points={task.storyPoints ?? undefined} />
        {task.subtaskCount > 0 && (
          <span title={`${task.subtaskCount} sub-tasks`} className="inline-flex items-center gap-1 tabular-nums">
            <ChecklistIcon className="size-3" />
            {task.subtaskCount}
          </span>
        )}
        {task.commentCount > 0 && (
          <span title={`${task.commentCount} comments`} className="inline-flex items-center gap-1 tabular-nums">
            <CommentIcon className="size-3" />
            {task.commentCount}
          </span>
        )}
        <span className="ml-auto">
          <TaskAssignees people={task.assignees.map((person) => ({ id: person.id, name: person.name ?? person.email }))} />
        </span>
      </div>
    </div>
  );
}
