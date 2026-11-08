import Link from "next/link";
import { StoryPointsBadge } from "@/components/backlog/story-points-badge";
import { ProjectPriorityBadge } from "@/components/projects/project-priority-badge";
import { TaskStatusChip } from "@/components/tasks/task-status-chip";
import { STATUS_DOT } from "@/components/tasks/task-tone";
import { TaskTypeIcon } from "@/components/tasks/task-type-icon";
import { ChevronRightIcon } from "@/components/ui/table-icons";
import { cn } from "@/lib/cn";
import { formatDeadline } from "@/lib/format-date";
import { isTomorrow } from "@/lib/my-tasks-groups";
import type { AssignedTask } from "@/types/task";

/*
 * One row of "My tasks": a status-coloured edge, what it is, where it lives
 * (key · project · sprint), its priority, points and status, and a due pill.
 *
 * THE ROW LINKS TO THE PROJECT'S BOARD, not to the task — there is no `?task=`
 * deep link yet, so the honest destination is the screen the task is on: the
 * sprint board when it is in a sprint, the backlog when it is not.
 *
 * NO DRAG, NO CHECKBOX, NO STATUS PICKER. This list spans projects, and a
 * control here would have to decide what "next status" means across six
 * workflows. Editing stays on the board, which knows.
 *
 * Overdue is amber, not red — late is a fact to notice, not an error. Done
 * work is struck through and dimmed so the Everything tab reads at a glance.
 */
function DuePill({ due, today, late, done }: { due: string | null; today: string; late: boolean; done: boolean }) {
  if (!due) return <span className="w-24 shrink-0 text-right text-xs text-text-subtle">No date</span>;

  const isToday = due === today && !done;
  const label = isToday ? "Today" : isTomorrow(due, today) ? "Tomorrow" : formatDeadline(due);

  return (
    <span className="flex w-24 shrink-0 justify-end">
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
          late ? "bg-warning-subtle font-semibold text-warning" : isToday ? "bg-brand-subtle text-text-brand" : "text-text-muted",
        )}
      >
        {label}
      </span>
    </span>
  );
}

export function MyTaskRow({ task, today }: { task: AssignedTask; today: string }) {
  const href = task.sprintId ? `/board/sprint?project=${task.projectId}` : `/board/backlog?project=${task.projectId}`;
  const due = task.dueDate?.slice(0, 10) ?? null;
  const done = task.status.group === "COMPLETE";
  const late = due !== null && !done && due < today;

  return (
    <li>
      <Link
        href={href}
        className="group relative flex items-center gap-3 py-3 pr-3 pl-4 transition-colors duration-100 ease-standard hover:bg-surface-hover"
      >
        <span aria-hidden="true" className={cn("absolute inset-y-2 left-0 w-1 rounded-r-full", STATUS_DOT[task.status.color])} />
        <TaskTypeIcon type={task.type} />

        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-sm font-medium", done ? "text-text-subtle line-through" : "text-text")}>
            {task.title}
          </span>
          <span className="mt-1 flex min-w-0 items-center gap-1.5 text-2xs text-text-subtle">
            <span className="shrink-0 rounded-xs bg-chip px-1 font-mono font-semibold text-text-muted">{task.key}</span>
            <span className="truncate">{task.project.name}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{task.sprint?.name ?? "Backlog"}</span>
          </span>
        </span>

        <span className="hidden shrink-0 items-center gap-2 md:flex">
          {task.priority && <ProjectPriorityBadge priority={task.priority} />}
          <StoryPointsBadge points={task.storyPoints ?? undefined} />
          <TaskStatusChip status={task.status} />
        </span>

        <DuePill due={due} today={today} late={late} done={done} />
        <ChevronRightIcon className="size-4 shrink-0 text-text-subtle transition-transform duration-100 ease-standard group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}
