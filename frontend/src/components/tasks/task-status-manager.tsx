"use client";

import { useState } from "react";
import { TaskStatusDetails } from "@/components/tasks/task-status-details";
import { TaskStatusOrderList } from "@/components/tasks/task-status-order-list";
import type { useStatusEditor } from "@/components/tasks/use-status-editor";
import { ChevronDownIcon, CloseIcon } from "@/components/ui/icons";
import type { TaskStatusOption } from "@/types/task";

/**
 * Managing a project's statuses — the ordered list with drag handles and "+",
 * and the detail view per status — with no container of its own.
 *
 * Container-free on purpose: the SAME manager renders inside the task drawer's
 * Status menu (so a status can be added or reordered without leaving the task
 * being written) and inside the backlog toolbar's dialog. The caller owns the
 * `useStatusEditor` state, which is what lets the drawer's menu select a status
 * the moment the manager creates it.
 */
export function TaskStatusManager({
  editor,
  titleId,
  onBack,
  onClose,
  onDeleted,
}: {
  editor: ReturnType<typeof useStatusEditor>;
  titleId?: string;
  /** Shown as a back arrow on the list view — the drawer menu's way back to picking. */
  onBack?: () => void;
  onClose?: () => void;
  onDeleted?: (status: TaskStatusOption) => void;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = editor.statuses.find((status) => status.id === detailId) ?? null;
  const defaultName = editor.statuses.find((status) => status.isDefault)?.name ?? "the default";
  const back = detail ? () => setDetailId(null) : onBack;

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-border px-1 pb-2.5">
        {back && (
          <button
            type="button"
            onClick={back}
            aria-label={detail ? "Back to all statuses" : "Back to choosing a status"}
            className="grid size-7 place-items-center rounded-sm text-text-subtle transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
          >
            <ChevronDownIcon className="size-4 rotate-90" />
          </button>
        )}
        <h2 id={titleId} className="min-w-0 flex-1 truncate text-sm font-semibold text-text">
          {detail ? detail.name : "Statuses"}
        </h2>
        <span aria-live="polite" className="text-2xs text-text-subtle">
          {editor.isPending ? "Saving…" : ""}
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-7 place-items-center rounded-sm bg-surface-hover text-text-muted hover:bg-surface-sunken hover:text-text"
          >
            <CloseIcon className="size-4" />
          </button>
        )}
      </div>

      {detail ? (
        <TaskStatusDetails
          key={detail.id}
          status={detail}
          defaultName={defaultName}
          pending={editor.isPending}
          onUpdate={(patch) => editor.update(detail.id, patch)}
          onDelete={() =>
            editor.remove(detail, () => {
              setDetailId(null);
              onDeleted?.(detail);
            })
          }
        />
      ) : (
        <TaskStatusOrderList
          statuses={editor.statuses}
          pending={editor.isPending}
          onReorder={editor.reorder}
          onCreate={(group, name, color) => editor.create(group, name, color)}
          onOpen={setDetailId}
        />
      )}
    </div>
  );
}
