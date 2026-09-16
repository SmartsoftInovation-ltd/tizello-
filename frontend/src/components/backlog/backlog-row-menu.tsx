"use client";

import { OpenIcon } from "@/components/projects/project-action-icons";
import { ProjectGlyph } from "@/components/projects/project-glyph";
import { STATUS_DOT } from "@/components/tasks/task-tone";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { Task } from "@/types/task";

const TRIGGER = buttonVariants({ variant: "subtle", size: "icon", className: "size-7" });

/**
 * The per-row ⋯ menu, laid out like `ProjectActionsList` so a task and a
 * project offer their actions the same way: a header that names the record,
 * then View, Edit and — past a separator — Delete, each with its icon.
 *
 * The header is the task, not a caption — glyph, title, key and status —
 * because a menu opened from the ninth row has to say which task it is before
 * it offers to delete it.
 *
 * View is for everyone who can see the row. Edit and Delete are ABSENT rather
 * than disabled for someone who may not change tasks. There is no task page
 * yet, so View and Edit both open the task drawer; View is the read, Edit the
 * promise that the fields in it are yours to change.
 */
export function BacklogRowMenu({
  task,
  onView,
  onEdit,
  onDelete,
}: {
  task: Task;
  onView: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${task.key}, ${task.title}`}
        className={TRIGGER}
      >
        <MoreIcon className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <div className="flex items-start gap-2 px-2 pt-1.5 pb-2">
          <ProjectGlyph icon={task.icon} color={task.color} className="mt-0.5" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{task.title}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-text-subtle">
              <span className="font-mono">{task.key}</span>
              <span aria-hidden="true">·</span>
              <span
                aria-hidden="true"
                className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[task.status.color])}
              />
              {task.status.name}
            </p>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem icon={<OpenIcon />} onSelect={onView}>
          View task
        </DropdownMenuItem>

        {onEdit && (
          <DropdownMenuItem icon={<PencilIcon />} onSelect={onEdit}>
            Edit task
          </DropdownMenuItem>
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
