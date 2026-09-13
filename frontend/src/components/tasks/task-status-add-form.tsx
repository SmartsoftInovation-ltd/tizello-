"use client";

import { useState } from "react";
import { TaskStatusChip } from "@/components/tasks/task-status-chip";
import { STATUS_DOT } from "@/components/tasks/task-tone";
import { CheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import {
  STATUS_COLORS,
  STATUS_COLOR_LABEL,
  TASK_STATUS_GROUP_LABEL,
  type StatusColor,
  type TaskStatusGroup,
} from "@/types/task";

/**
 * The "+" form under a group heading: a live preview chip, the name, the
 * colour, and explicit Add / Cancel buttons.
 *
 * A small card rather than a bare input dropped into the list: the input alone
 * gave no way to pick a colour and no visible way to confirm, so a status could
 * only be added by knowing to press Enter. The preview chip shows exactly what
 * will land in the list before it does.
 *
 * Escape stops propagating — the dialog around it treats Escape as "close", and
 * cancelling a half-typed name should not also close the editor.
 */
export function TaskStatusAddForm({
  group,
  pending,
  onAdd,
  onCancel,
}: {
  group: TaskStatusGroup;
  pending: boolean;
  onAdd: (name: string, color: StatusColor) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<StatusColor>("gray");
  const value = name.trim();

  function submit() {
    if (value && !pending) onAdd(value, color);
  }

  return (
    <div className="mx-1 mb-2 rounded-md border border-border bg-surface-sunken p-2.5">
      <div className="flex h-6 items-center">
        <TaskStatusChip status={{ name: value || "New status", color }} />
      </div>

      <input
        autoFocus
        aria-label={`New status name in ${TASK_STATUS_GROUP_LABEL[group]}`}
        placeholder="Status name"
        value={name}
        maxLength={40}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          }
        }}
        className="mt-2 h-8 w-full rounded-sm border border-border bg-surface px-2.5 text-sm text-text transition-colors duration-100 ease-standard placeholder:text-text-subtle hover:border-border-strong focus-visible:border-focus focus-visible:outline-none"
      />

      <div role="radiogroup" aria-label="Colour" className="mt-2 flex flex-wrap gap-1">
        {STATUS_COLORS.map((choice) => (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={color === choice}
            aria-label={STATUS_COLOR_LABEL[choice]}
            title={STATUS_COLOR_LABEL[choice]}
            onClick={() => setColor(choice)}
            className={cn(
              "grid size-6 place-items-center rounded-full border transition-colors duration-100 ease-standard",
              color === choice ? "border-border-strong bg-surface" : "border-transparent hover:bg-surface",
            )}
          >
            <span className={cn("grid size-4 place-items-center rounded-full", STATUS_DOT[choice])}>
              {color === choice && <CheckIcon className="size-2.5 text-surface" />}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-2.5 flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-sm px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!value || pending}
          onClick={submit}
          className="rounded-sm bg-brand-500 px-3 py-1.5 text-xs font-semibold text-on-brand transition-colors duration-100 ease-standard hover:bg-brand-400 disabled:pointer-events-none disabled:opacity-50"
        >
          Add status
        </button>
      </div>
    </div>
  );
}
