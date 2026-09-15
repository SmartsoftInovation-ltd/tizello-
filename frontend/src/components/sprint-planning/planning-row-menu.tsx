"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { OpenIcon } from "@/components/projects/project-action-icons";
import type { TaskScope } from "@/components/tasks/task-draft";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu-item";
import { MoreIcon, TrashIcon } from "@/components/ui/icons";
import { moveTaskAction } from "@/lib/actions/task-bulk-actions";
import { openSprints } from "@/lib/sprint-plan";
import type { TaskMove } from "@/lib/task-bulk";
import { taskErrorCopy, type Task } from "@/types/task";

/**
 * A planning row's ⋯ menu: open the task, MOVE it without dragging, delete it.
 *
 * "Move to" is the drag's twin, and it is not optional polish. Dragging a row
 * past a long backlog into a sprint box two screens up is the least precise
 * gesture on the page, a touch screen makes it worse, and a keyboard user
 * should not have to learn dnd-kit's arrow-key protocol to plan a sprint. So
 * every destination a drag can reach is one click here: each open sprint, the
 * backlog, and the top or bottom of the task's own box — the two ranks Jira's
 * menu offers, because "this is next" and "this can wait" are what ranking is
 * mostly for.
 *
 * Moves go through the same `PATCH /tasks/:id/move` as a drop.
 */
const TRIGGER = buttonVariants({ variant: "ghost", size: "icon", className: "size-7" });

export function PlanningRowMenu({
  task,
  siblings,
  scope,
  onOpen,
  onDelete,
}: {
  task: Task;
  /** The rows of the box this task is in, in rank order — for top and bottom. */
  siblings: Task[];
  scope: TaskScope;
  onOpen: () => void;
  onDelete?: () => void;
}) {
  const [, startTransition] = useTransition();
  const others = siblings.filter((entry) => entry.id !== task.id);
  const destinations = openSprints(scope.sprints).filter((sprint) => sprint.id !== task.sprintId);

  function move(patch: TaskMove, done: string) {
    startTransition(async () => {
      const result = await moveTaskAction(scope.workspaceId, scope.projectId, task.id, patch);
      if (result.code) toast.error(`${task.key} did not move. ${taskErrorCopy(result.code)}`);
      else toast.success(`${task.key} ${done}.`);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`Actions for ${task.key}, ${task.title}`} className={TRIGGER}>
        <MoreIcon className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem icon={<OpenIcon />} onSelect={onOpen}>
          Open task
        </DropdownMenuItem>

        {scope.canContribute && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            {destinations.map((sprint) => (
              <DropdownMenuItem key={sprint.id} onSelect={() => move({ sprintId: sprint.id }, `moved to ${sprint.name}`)}>
                {sprint.name}
                {sprint.state === "ACTIVE" ? " (active)" : ""}
              </DropdownMenuItem>
            ))}
            {task.sprintId && (
              <DropdownMenuItem onSelect={() => move({ sprintId: null }, "moved to the backlog")}>Backlog</DropdownMenuItem>
            )}
            {others.length > 0 && siblings[0]?.id !== task.id && (
              <DropdownMenuItem onSelect={() => move({ afterId: null, beforeId: others[0].id }, "moved to the top")}>
                Top of this list
              </DropdownMenuItem>
            )}
            {others.length > 0 && siblings[siblings.length - 1]?.id !== task.id && (
              <DropdownMenuItem onSelect={() => move({ afterId: others[others.length - 1].id, beforeId: null }, "moved to the bottom")}>
                Bottom of this list
              </DropdownMenuItem>
            )}
          </>
        )}

        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="danger" icon={<TrashIcon />} onSelect={onDelete}>
              Delete task
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
