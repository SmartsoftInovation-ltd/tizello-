"use client";

import { useRef, useState } from "react";
import { useMenuPopover } from "@/components/projects/use-menu-popover";
import type { Task } from "@/types/task";

/**
 * Parent-task: one other task in this project.
 *
 * THE LIST NEVER OFFERS A CYCLE. The task itself and every task below it are
 * left out, so a choice here cannot make a task its own ancestor — the API
 * refuses that with a `422` (`task.md` §*Sub-tasks*), and a picker that offered
 * it would be offering an error. A search box sits on top because a backlog is
 * long and a key is what people type.
 */
const PANEL_HEIGHT = 320;

/** The task and everything under it, walked breadth-first over `parentId`. */
function subtreeOf(taskId: string, tasks: Task[]): Set<string> {
  const subtree = new Set([taskId]);
  let grew = true;

  while (grew) {
    grew = false;
    for (const task of tasks) {
      if (task.parentId && subtree.has(task.parentId) && !subtree.has(task.id)) {
        subtree.add(task.id);
        grew = true;
      }
    }
  }

  return subtree;
}

export function TaskParentPicker({
  taskId,
  tasks,
  value,
  onChange,
}: {
  /** Absent on create — a task that does not exist has no subtree to exclude. */
  taskId?: string;
  tasks: Task[];
  value: string;
  onChange: (parentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  };
  const position = useMenuPopover({ open, triggerRef, panelRef, height: PANEL_HEIGHT, onDismiss: close });

  const excluded = taskId ? subtreeOf(taskId, tasks) : new Set<string>();
  const needle = query.trim().toLowerCase();
  const candidates = tasks.filter(
    (task) =>
      !excluded.has(task.id) &&
      (!needle || task.title.toLowerCase().includes(needle) || task.key.toLowerCase().includes(needle)),
  );
  const current = tasks.find((task) => task.id === value);

  function choose(parentId: string) {
    onChange(parentId);
    close();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={current ? `Parent task: ${current.key} ${current.title}` : "Parent task: none"}
        onClick={() => setOpen((state) => !state)}
        className="flex h-9 w-full items-center gap-2 rounded-sm px-2.5 text-left text-sm transition-colors duration-100 ease-standard hover:bg-surface-hover"
      >
        {current ? (
          <>
            <span className="shrink-0 font-mono text-2xs text-text-subtle">{current.key}</span>
            <span className="min-w-0 truncate text-text">{current.title}</span>
          </>
        ) : (
          <span className="text-text-subtle">Choose a parent task</span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          popover="manual"
          role="dialog"
          aria-label="Choose a parent task"
          className="fixed inset-auto m-0 flex max-h-80 w-72 flex-col rounded-md border border-border bg-surface p-1 shadow-overlay"
          style={{ top: position.top, left: position.left }}
        >
          <input
            autoFocus
            aria-label="Search tasks"
            placeholder="Search by title or key"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            /* Inside the drawer's form — Enter must not save the task. */
            onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
            className="mb-1 h-8 w-full rounded-sm border border-border bg-surface px-2 text-xs text-text placeholder:text-text-subtle"
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {value && (
              <button type="button" onClick={() => choose("")} className="w-full rounded-sm px-2 py-1.5 text-left text-xs text-text-muted hover:bg-surface-hover">
                Remove parent
              </button>
            )}
            {candidates.length === 0 && (
              <p className="px-2 py-3 text-center text-2xs text-text-subtle">No matching tasks</p>
            )}
            {candidates.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => choose(task.id)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors duration-100 ease-standard hover:bg-surface-hover"
              >
                <span className="shrink-0 font-mono text-2xs text-text-subtle">{task.key}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-text">{task.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
