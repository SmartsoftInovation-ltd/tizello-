"use client";

import { useState } from "react";
import { TaskStatusChip } from "@/components/tasks/task-status-chip";
import { PencilIcon, PlusIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import {
  STATUS_COLORS,
  TASK_STATUS_GROUPS,
  TASK_STATUS_GROUP_LABEL,
  type StatusColor,
  type TaskStatusGroup,
  type TaskStatusOption,
} from "@/types/task";

/**
 * Choosing a status — and creating one without leaving the task.
 *
 * TYPE TO SEARCH, TYPE TO CREATE. The input filters the grouped list; a name
 * that matches nothing offers "Create" rows, one per group, each drawing the
 * chip exactly as it will appear. That is Notion's status menu, and it means a
 * workflow step somebody discovers while writing a task costs one line of
 * typing instead of a detour through a settings dialog.
 *
 * Enter picks the only match, or — when nothing matches — creates the name in
 * To-do. It is `preventDefault`ed: this sits inside the drawer's form, and an
 * unhandled Enter would save the task.
 *
 * A new status takes the next colour round the palette rather than grey, so
 * three quick creations are three distinguishable chips.
 */
export function TaskStatusSearchList({
  statuses,
  value,
  canCreate,
  pending,
  onSelect,
  onCreate,
  onManage,
}: {
  statuses: TaskStatusOption[];
  value: string;
  canCreate: boolean;
  pending: boolean;
  onSelect: (statusId: string) => void;
  onCreate: (name: string, group: TaskStatusGroup, color: StatusColor) => void;
  onManage?: () => void;
}) {
  const [query, setQuery] = useState("");
  const name = query.trim();
  const needle = name.toLowerCase();

  const visible = statuses.filter((status) => status.name.toLowerCase().includes(needle));
  const exact = statuses.some((status) => status.name.toLowerCase() === needle);
  const offerCreate = canCreate && Boolean(name) && !exact;
  const color = STATUS_COLORS[1 + (statuses.length % (STATUS_COLORS.length - 1))];
  const groups = TASK_STATUS_GROUPS.map((group) => ({
    group,
    items: visible.filter((status) => status.group === group),
  })).filter(({ items }) => items.length > 0);

  return (
    <>
      <div className="border-b border-border p-2">
        <input
          autoFocus
          value={query}
          maxLength={40}
          aria-label={canCreate ? "Search or create a status" : "Search statuses"}
          placeholder={canCreate ? "Search or create a status…" : "Search statuses…"}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (visible.length === 1 && name) onSelect(visible[0].id);
            else if (offerCreate && !pending) onCreate(name, "TODO", color);
          }}
          className="h-8 w-full rounded-sm border border-border bg-surface-sunken px-2.5 text-sm text-text transition-colors duration-100 ease-standard placeholder:text-text-subtle focus-visible:border-focus focus-visible:bg-surface focus-visible:outline-none"
        />
      </div>

      <div role="listbox" aria-label="Status" className="min-h-0 flex-1 overflow-y-auto p-1">
        {groups.map(({ group, items }, index) => (
          <div key={group} role="group" aria-label={TASK_STATUS_GROUP_LABEL[group]} className={cn("py-1", index > 0 && "border-t border-border")}>
            <p className="px-2 pt-1 pb-1.5 text-2xs text-text-subtle">{TASK_STATUS_GROUP_LABEL[group]}</p>
            {items.map((status) => (
              <button
                key={status.id}
                type="button"
                role="option"
                aria-selected={status.id === value}
                onClick={() => onSelect(status.id)}
                className={cn(
                  "flex w-full min-w-0 items-center rounded-sm px-2 py-1 text-left transition-colors duration-100 ease-standard hover:bg-surface-hover",
                  status.id === value && "bg-surface-hover",
                )}
              >
                <TaskStatusChip status={status} />
              </button>
            ))}
          </div>
        ))}

        {groups.length === 0 && !offerCreate && (
          <p className="px-2 py-5 text-center text-xs text-text-subtle">No status called “{name}”.</p>
        )}

        {offerCreate && (
          <div className={cn("py-1", groups.length > 0 && "border-t border-border")}>
            <p className="px-2 pt-1 pb-1.5 text-2xs text-text-subtle">Create a new status in</p>
            {TASK_STATUS_GROUPS.map((group) => (
              <button
                key={group}
                type="button"
                disabled={pending}
                onClick={() => onCreate(name, group, color)}
                className="flex w-full min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors duration-100 ease-standard hover:bg-surface-hover disabled:opacity-50"
              >
                <PlusIcon className="size-3.5 shrink-0 text-text-subtle" />
                <TaskStatusChip status={{ name, color }} />
                <span className="ml-auto shrink-0 text-2xs text-text-subtle">{TASK_STATUS_GROUP_LABEL[group]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {onManage && (
        <div className="border-t border-border p-1">
          <button
            type="button"
            onClick={onManage}
            className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs text-text-subtle transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
          >
            <PencilIcon className="size-3.5" />
            Manage statuses
          </button>
        </div>
      )}
    </>
  );
}
