import { STATUS_CHIP, STATUS_DOT } from "@/components/tasks/task-tone";
import { cn } from "@/lib/cn";
import type { TaskStatusRef } from "@/types/task";

/**
 * A status as a pill — the dot for recognition, the name for meaning. The same
 * chip in the picker, the editor, the backlog sections and the drawer, so a
 * status looks like itself everywhere it appears.
 *
 * Its own base string rather than `BADGE_BASE`: a status is a pill
 * (`rounded-full`) where a badge is a tag, and `cn` is a plain join, so
 * overriding the badge's radius would leave two radii for source order to pick.
 */
const PILL =
  "inline-flex max-w-full min-w-0 shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

export function TaskStatusChip({
  status,
  className,
}: {
  status: Pick<TaskStatusRef, "name" | "color">;
  className?: string;
}) {
  return (
    <span className={cn(PILL, STATUS_CHIP[status.color], className)}>
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[status.color])} />
      <span className="truncate">{status.name}</span>
    </span>
  );
}
