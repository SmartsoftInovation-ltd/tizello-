"use client";

import { BacklogRowMenu } from "@/components/backlog/backlog-row-menu";
import { TaskAssignee } from "@/components/backlog/task-assignee";
import { ProjectGlyph } from "@/components/projects/project-glyph";
import { ProjectPriorityBadge } from "@/components/projects/project-priority-badge";
import { Badge } from "@/components/ui/badge";
import { AttachmentIcon, ChecklistIcon, CommentIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/format-date";
import { taskDelayDays } from "@/lib/task-delay";
import type { Task } from "@/types/task";

/**
 * One task on the backlog. Flat and bordered, per DESIGN-SYSTEM.md — a list of
 * rows, not a stack of floating cards.
 *
 * The title is a real `<button>` that opens the drawer, so the fastest path to
 * editing is also keyboard-reachable. The second line carries only what is SET
 * — priority, due date, tags, and counts for sub-tasks, comments and files —
 * because a row of "Empty" chips would bury the three that matter.
 *
 * An overdue task's date is amber rather than red: late is a fact to notice,
 * not an error, and `danger` is reserved for things that failed.
 */
const ROW =
  "group relative flex items-start gap-2 rounded-md border border-border bg-surface p-2 transition-colors duration-100 ease-standard hover:bg-surface-hover";

/* Revealed by hover on a pointer, always present below `sm` where there is no
   hover, and on focus inside the row so the keyboard never chases a ghost. */
const ACTIONS =
  "shrink-0 opacity-100 transition-opacity duration-100 ease-standard sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100";

export function TaskRow({
  task,
  today,
  onOpen,
  onDelete,
  handle,
}: {
  task: Task;
  today: string;
  onOpen: () => void;
  onDelete?: () => void;
  /** The drag grip, when the row can be moved to another status. */
  handle?: React.ReactNode;
}) {
  const delay = task.dueDate
    ? taskDelayDays({ dueDate: task.dueDate, completedAt: task.completedAt ?? "", today })
    : null;
  const late = task.status.group !== "COMPLETE" && delay !== null && delay > 0;

  return (
    <div className={ROW}>
      {handle}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          {(task.icon || task.color) && (
            <ProjectGlyph icon={task.icon} color={task.color} size="default" className="self-center" />
          )}
          <span className="shrink-0 font-mono text-2xs font-semibold text-text-subtle">
            {task.key}
          </span>
          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 flex-1 rounded-xs text-left text-sm font-medium break-words text-text"
          >
            {task.title}
          </button>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 empty:hidden">
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
          {task.subtaskCount > 0 && (
            <Meta label={`${task.subtaskCount} sub-tasks`} icon={<ChecklistIcon className="size-3" />} count={task.subtaskCount} />
          )}
          {task.commentCount > 0 && (
            <Meta label={`${task.commentCount} comments`} icon={<CommentIcon className="size-3" />} count={task.commentCount} />
          )}
          {task.attachments.length > 0 && (
            <Meta label={`${task.attachments.length} files`} icon={<AttachmentIcon className="size-3" />} count={task.attachments.length} />
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <TaskAssignee
          assignee={
            task.assignee
              ? { id: task.assignee.id, name: task.assignee.name ?? task.assignee.email }
              : undefined
          }
        />
        {onDelete && (
          <span className={ACTIONS}>
            <BacklogRowMenu taskId={task.key} title={task.title} onEdit={onOpen} onDelete={onDelete} />
          </span>
        )}
      </div>
    </div>
  );
}

function Meta({ label, icon, count }: { label: string; icon: React.ReactNode; count: number }) {
  return (
    <span title={label} className="inline-flex items-center gap-1 text-2xs text-text-subtle tabular-nums">
      {icon}
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
