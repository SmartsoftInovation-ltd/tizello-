"use client";

import { useState } from "react";
import { STATUS_DOT } from "@/components/tasks/task-tone";
import { TaskStatusChip } from "@/components/tasks/task-status-chip";
import { CheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import {
  STATUS_COLORS,
  STATUS_COLOR_LABEL,
  TASK_STATUS_GROUP_LABEL,
  type StatusColor,
  type TaskStatusOption,
} from "@/types/task";

/**
 * One status, opened from the editor: rename it, recolour it, make it the
 * default, or delete it.
 *
 * Every change saves on its own — a colour on click, the name on blur or Enter
 * — because the editor is a sequence of small decisions and a Save button at
 * the bottom of each one would be a click per decision for nothing.
 *
 * THE DEFAULT CANNOT BE DELETED FROM HERE, and says so instead of offering a
 * button that refuses: a project always needs somewhere for new tasks to
 * start, and somewhere for a deleted status's tasks to go. Delete asks twice,
 * and the second ask names how many tasks will move and where.
 */
const ROW =
  "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-xs transition-colors duration-100 ease-standard hover:bg-surface-hover disabled:opacity-50";

export function TaskStatusDetails({
  status,
  defaultName,
  pending,
  onUpdate,
  onDelete,
}: {
  status: TaskStatusOption;
  defaultName: string;
  pending: boolean;
  onUpdate: (patch: { name?: string; color?: StatusColor; isDefault?: true }) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(status.name);
  const [confirming, setConfirming] = useState(false);

  function saveName() {
    const value = name.trim();
    if (value && value !== status.name) onUpdate({ name: value });
    else setName(status.name);
  }

  return (
    <div className="mt-3 space-y-4 px-1">
      <div className="flex items-center justify-between gap-2">
        <TaskStatusChip status={{ name: name.trim() || status.name, color: status.color }} />
        <span className="text-2xs text-text-subtle">{TASK_STATUS_GROUP_LABEL[status.group]}</span>
      </div>

      <input
        aria-label="Status name"
        value={name}
        maxLength={40}
        onChange={(event) => setName(event.target.value)}
        onBlur={saveName}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            saveName();
          }
        }}
        className="h-8 w-full rounded-sm border border-border bg-surface px-2.5 text-sm text-text"
      />

      <fieldset>
        <legend className="text-2xs font-medium text-text-subtle">Colour</legend>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {STATUS_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              disabled={pending}
              aria-label={STATUS_COLOR_LABEL[color]}
              aria-pressed={status.color === color}
              onClick={() => status.color !== color && onUpdate({ color })}
              className={cn(
                "grid size-7 place-items-center rounded-full border transition-colors duration-100 ease-standard",
                status.color === color ? "border-border-strong bg-surface-hover" : "border-transparent hover:bg-surface-hover",
              )}
            >
              <span className={cn("grid size-4 place-items-center rounded-full", STATUS_DOT[color])}>
                {status.color === color && <CheckIcon className="size-2.5 text-surface" />}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="border-t border-border pt-2">
        {status.isDefault ? (
          <p className="px-2 py-1.5 text-xs text-text-subtle">
            New tasks start here. Make another status the default before deleting this one.
          </p>
        ) : (
          <>
            <button type="button" disabled={pending} onClick={() => onUpdate({ isDefault: true })} className={cn(ROW, "text-text")}>
              Set as default
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => (confirming ? onDelete() : setConfirming(true))}
              className={cn(ROW, "text-danger")}
            >
              {!confirming
                ? "Delete status"
                : status.taskCount > 0
                  ? `Delete — ${status.taskCount} task${status.taskCount === 1 ? "" : "s"} move to ${defaultName}`
                  : "Click again to delete"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
