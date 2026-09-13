"use client";

import { useId } from "react";
import type { TaskScope } from "@/components/tasks/task-draft";
import { TaskStatusManager } from "@/components/tasks/task-status-manager";
import { useStatusEditor } from "@/components/tasks/use-status-editor";
import { Dialog } from "@/components/ui/dialog";

/**
 * The status manager as a dialog, for the backlog toolbar's Statuses button —
 * the one place statuses are edited without a task open. Inside a task, the
 * same manager opens within the Status menu instead (`task-status-picker.tsx`).
 */
export function TaskStatusEditor({
  open,
  scope,
  onOpenChange,
}: {
  open: boolean;
  scope: TaskScope;
  onOpenChange: (open: boolean) => void;
}) {
  const titleId = useId();
  const editor = useStatusEditor(scope);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} aria-labelledby={titleId} className="max-w-sm">
      <div className="p-3">
        <TaskStatusManager editor={editor} titleId={titleId} onClose={() => onOpenChange(false)} />
      </div>
    </Dialog>
  );
}
