import { StoryPointsBadge } from "@/components/backlog/story-points-badge";
import { TaskAssignees } from "@/components/backlog/task-assignees";
import { ProjectPriorityBadge } from "@/components/projects/project-priority-badge";
import { STATUS_CARD } from "@/components/tasks/task-tone";
import { TaskTypeIcon } from "@/components/tasks/task-type-icon";
import { Badge } from "@/components/ui/badge";
import { ChecklistIcon, CommentIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format-date";
import { taskDelayDays } from "@/lib/task-delay";
import type { Task } from "@/types/task";

/**
 * One card on the current sprint board — the task as a column shows it: type
 * and key with the priority opposite, the title, then only what is SET (due
 * date, points, tags, sub-task and comment counts), and the assignees on the
 * right of a divided footer.
 *
 * THE CARD IS TINTED BY ITS STATUS (`STATUS_CARD`) — a soft wash and a tinted
 * hairline, nothing stronger. The column it sits in is what NAMES the status;
 * the wash only means a card read on its own, or carried over the board by the
 * drag overlay, still says where it belongs.
 *
 * There is deliberately no full-strength rail down the left edge. At four
 * pixels of undiluted `label-red` it stopped being an accent and became the
 * loudest thing in the column — a stripe that shouted the status the pill at
 * the top of the column had already said quietly.
 *
 * THE FOOTER IS ONE SET OF MATCHING CHIPS — points, sub-tasks, comments — all
 * on `Badge`'s geometry, then the avatars. Bare icon-and-number counts next to
 * a filled "5 pts" pill read as two different kinds of thing on one line; the
 * same pill three times reads as a row of facts. The rule above it is the only
 * line inside the card, and it is what makes the meta a footer rather than a
 * third paragraph.
 *
 * Flat at rest like every card in this app (DESIGN-SYSTEM.md, "Kanban cards
 * are flat") — the hairline and the wash do the work, and elevation is kept
 * for the hover lift and the dragged card. The card keeps its outline even
 * though the column around it dropped one: with a borderless column, the cards
 * ARE the structure. Overdue is amber, not red — late is a fact to notice, not
 * an error.
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
        "rounded-md border p-3 transition-[background-color,border-color,box-shadow] duration-100 ease-standard",
        STATUS_CARD[task.status.color],
        lifted ? "shadow-raised" : "hover:shadow-raised",
      )}
    >
      <div className="flex items-center gap-1.5">
        <TaskTypeIcon type={task.type} />
        <span className="font-mono text-2xs font-semibold tracking-wide text-text-subtle">{task.key}</span>
        {task.priority && (
          <span className="ml-auto">
            <ProjectPriorityBadge priority={task.priority} />
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onOpen}
        tabIndex={lifted ? -1 : undefined}
        className="mt-1.5 block w-full rounded-xs text-left text-sm leading-snug font-medium break-words text-text"
      >
        {task.title}
      </button>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 empty:hidden">
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

      <div className="mt-2.5 flex items-center gap-1.5 border-t border-border/60 pt-2.5">
        <StoryPointsBadge points={task.storyPoints ?? undefined} />
        {task.subtaskCount > 0 && (
          <Badge title={`${task.subtaskCount} sub-tasks`} className="tabular-nums">
            <ChecklistIcon className="size-3" />
            {task.subtaskCount}
          </Badge>
        )}
        {task.commentCount > 0 && (
          <Badge title={`${task.commentCount} comments`} className="tabular-nums">
            <CommentIcon className="size-3" />
            {task.commentCount}
          </Badge>
        )}
        <span className="ml-auto">
          <TaskAssignees people={task.assignees.map((person) => ({ id: person.id, name: person.name ?? person.email }))} />
        </span>
      </div>
    </div>
  );
}
