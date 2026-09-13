"use client";

import { useRef, useState } from "react";
import { PersonOption } from "@/components/projects/person-chip";
import { useMenuPopover } from "@/components/projects/use-menu-popover";
import { memberName } from "@/components/tasks/task-draft";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/initials";
import type { WorkspaceMemberRow } from "@/lib/workspaces";

/**
 * One assignee, picked from the workspace roster.
 *
 * The roster rather than the project's members: the API accepts anyone in the
 * workspace (`task.md` §*Assignee*), and a task is often the first thing a
 * newcomer to a project is handed — making them a collaborator first would be
 * a second errand before the first one.
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
  /** A `userId`, or `""` when unassigned. */
  value: string;
  onChange: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };
  const position = useMenuPopover({
    open,
    triggerRef,
    panelRef,
    height: PANEL_HEIGHT,
    onDismiss: close,
  });

  const current = members.find((member) => member.userId === value);
  const name = current ? memberName(current) : "";

  function choose(userId: string) {
    onChange(userId);
    close();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={current ? `Assignee: ${name}` : "Assignee: nobody"}
        onClick={() => setOpen((state) => !state)}
        className="flex h-9 w-full items-center gap-2 rounded-sm px-2.5 text-left text-sm transition-colors duration-100 ease-standard hover:bg-surface-hover"
      >
        {current ? (
          <>
            <Avatar className="size-5 border border-border text-text-muted">
              <AvatarFallback className="text-2xs">
                <span aria-hidden="true">{initials(name)}</span>
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 truncate text-text">{name}</span>
          </>
        ) : (
          <span className="text-text-subtle">Assign someone</span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          popover="manual"
          role="menu"
          aria-label="Assign to"
          className="fixed inset-auto m-0 max-h-72 w-64 overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-overlay"
          style={{ top: position.top, left: position.left }}
        >
          {value && (
            <button
              type="button"
              role="menuitem"
              onClick={() => choose("")}
              className="w-full rounded-sm px-2 py-1.5 text-left text-xs text-text-muted transition-colors duration-100 ease-standard hover:bg-surface-hover"
            >
              Remove assignee
            </button>
          )}
          {members.map((member) => (
            <PersonOption
              key={member.userId}
              name={memberName(member)}
              onSelect={() => choose(member.userId)}
            />
          ))}
        </div>
      )}
    </>
  );
}
