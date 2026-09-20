import Link from "next/link";
import { StoryPointsBadge } from "@/components/backlog/story-points-badge";
import { ProjectPriorityBadge } from "@/components/projects/project-priority-badge";
import { TaskStatusChip } from "@/components/tasks/task-status-chip";
import { TaskTypeIcon } from "@/components/tasks/task-type-icon";
import { cn } from "@/lib/cn";
import { formatDeadline } from "@/lib/format-date";
import { isTomorrow } from "@/lib/my-tasks-groups";
import type { AssignedTask } from "@/types/task";

/*
 * One row of "My tasks": what it is, where it lives, and when it is due.
 *
 * THE ROW LINKS TO THE PROJECT'S BOARD, not to the task. There is no `?task=`
 * deep link in this app yet, so the honest destination is the screen the task
 * is on — the sprint board when it is in a sprint, the backlog when it is not.
 * The same rule the search palette applies, and the same gap: when the deep
 * link lands, both change in one place each.
 *
 * NO DRAG, NO CHECKBOX, NO STATUS PICKER. This list spans projects, and a
 * control here would have to decide what "move" or "next status" means across
 * six different workflows. Editing stays on the board, which knows.
 *
 * Overdue is amber, not red — late is a fact to notice, not an error. The same
 * choice the board card makes, so the two never disagree about what a slipped
 * date looks like.
 */
export function MyTaskRow({ task, today }: { task: AssignedTask; today: string }) {
  const href = task.sprintId
    ? `/board/sprint?project=${task.projectId}`
    : `/board/backlog?project=${task.projectId}`;

  const due = task.dueDate?.slice(0, 10) ?? null;
  const late = due !== null && task.status.group !== "COMPLETE" && due < today;

  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors duration-100 ease-standard hover:bg-surface-hover"
      >
        <TaskTypeIcon type={task.type} />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-text">{task.title}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-2xs text-text-subtle">
            <span className="font-mono">{task.key}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{task.project.name}</span>
          </span>
        </span>

        <span className="hidden shrink-0 items-center gap-2 sm:flex">
          {task.priority && <ProjectPriorityBadge priority={task.priority} />}
          <StoryPointsBadge points={task.storyPoints ?? undefined} />
          <TaskStatusChip status={task.status} />
        </span>

        <span
          className={cn(
            "w-24 shrink-0 text-right text-xs tabular-nums",
            late ? "font-semibold text-warning" : "text-text-muted",
          )}
        >
          {due ? (isTomorrow(due, today) ? "Tomorrow" : formatDeadline(due)) : "—"}
        </span>
      </Link>
    </li>
  );
}
