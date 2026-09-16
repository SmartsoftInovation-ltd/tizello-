"use client";

import { useRef, useState } from "react";
import { TaskAssignee } from "@/components/backlog/task-assignee";
import { TaskAssignees } from "@/components/backlog/task-assignees";
import { useMenuPopover } from "@/components/projects/use-menu-popover";
import { memberName } from "@/components/tasks/task-draft";
import { CheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { WorkspaceMemberRow } from "@/lib/workspaces";

/**
 * Everyone on a task, picked from the workspace roster.
 *
 * The roster rather than the project's members: the API accepts anyone in the
 * workspace (`task.md` §Assignees), and a task is often the first thing a
 * newcomer to a project is handed — making them a collaborator first would be
 * a second errand before the first one.
 *
 * SEVERAL PEOPLE, SO THE MENU STAYS OPEN. Each row is a checkbox item; clicking
 * one toggles that person and leaves the list up for the next, and outside
 * click or Escape closes it. Order is the order people were ticked, which is
 * the order the row's avatars draw in.
 *
 * A popover for the reason every menu in these panels is one: it opens inside
 * a `<dialog>`, where a fixed descendant is clipped and a portal renders behind
 * the backdrop. `use-menu-popover.ts` documents it.
 */
const PANEL_HEIGHT = 300;

export function TaskAssigneePicker({
  members,
  value,
  onChange,
}: {
  members: WorkspaceMemberRow[];
  /** User ids, in assignment order; `[]` when unassigned. */
  value: string[];
  onChange: (userIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };
  const position = useMenuPopover({ open, triggerRef, panelRef, height: PANEL_HEIGHT, onDismiss: close });

  /* Ids with no roster row (someone who left the workspace) are kept in `value`
     but cannot be drawn by name. */
  const chosen = value.flatMap((userId) => {
    const member = members.find((row) => row.userId === userId);
    return member ? [{ id: userId, name: memberName(member) }] : [];
  });
  const toggle = (userId: string) =>
    onChange(value.includes(userId) ? value.filter((id) => id !== userId) : [...value, userId]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={chosen.length > 0 ? `Assignees: ${chosen.map((person) => person.name).join(", ")}` : "Assignees: nobody"}
        onClick={() => setOpen((state) => !state)}
        className="flex h-9 w-full items-center gap-2 rounded-sm px-2.5 text-left text-sm transition-colors duration-100 ease-standard hover:bg-surface-hover"
      >
        {chosen.length > 0 ? (
          <>
            <TaskAssignees people={chosen} />
            <span className="min-w-0 truncate text-text">
              {chosen.length === 1 ? chosen[0].name : `${chosen[0].name} +${chosen.length - 1}`}
            </span>
          </>
        ) : (
          <span className="text-text-subtle">Assign people</span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          popover="manual"
          role="menu"
          aria-label="Assign to"
          className="scrollbar-hidden fixed inset-auto m-0 max-h-72 w-64 overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-overlay"
          style={{ top: position.top, left: position.left }}
        >
          {members.map((member) => {
            const checked = value.includes(member.userId);
            const name = memberName(member);
            return (
              <button
                key={member.userId}
                type="button"
                role="menuitemcheckbox"
                aria-checked={checked}
                onClick={() => toggle(member.userId)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors duration-100 ease-standard hover:bg-surface-hover",
                  checked ? "bg-surface-hover text-text" : "text-text-muted hover:text-text",
                )}
              >
                <TaskAssignee assignee={{ id: member.userId, name }} size="sm" />
                <span className="min-w-0 flex-1 truncate">{name}</span>
                {checked ? <CheckIcon className="size-3.5 shrink-0 text-text-brand" /> : <span aria-hidden="true" className="size-3.5 shrink-0" />}
              </button>
            );
          })}

          {value.length > 0 && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onChange([]);
                close();
              }}
              className="mt-1 w-full rounded-sm border-t border-border px-2 pt-2 pb-1.5 text-left text-xs text-text-muted transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
            >
              Remove everyone
            </button>
          )}
        </div>
      )}
    </>
  );
}
