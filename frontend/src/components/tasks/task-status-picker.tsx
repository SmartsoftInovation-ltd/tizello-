"use client";

import { useRef, useState } from "react";
import { useMenuPopover } from "@/components/projects/use-menu-popover";
import type { TaskScope } from "@/components/tasks/task-draft";
import { TaskStatusChip } from "@/components/tasks/task-status-chip";
import { TaskStatusManager } from "@/components/tasks/task-status-manager";
import { TaskStatusSearchList } from "@/components/tasks/task-status-search-list";
import { useStatusEditor } from "@/components/tasks/use-status-editor";
import { defaultStatusId } from "@/lib/task-status-order";

/**
 * The Status control in the task panel. Everything about statuses happens
 * INSIDE this one menu, without a second dialog stacked over the drawer:
 *
 * - **Pick** — search the grouped list, or type a new name and create it; a
 *   created status is selected for this task at once.
 * - **Manage** — the full manager (reorder by drag, move between groups,
 *   rename, recolour, set default, delete), with a back arrow to picking.
 *
 * The status list is this menu's own `useStatusEditor` state rather than the
 * page's prop, so a status created here is choosable immediately instead of
 * after the revalidated page arrives. A deleted status that this task was on
 * falls back to the default, so Save never sends an id that no longer exists.
 */
const PANEL_WIDTH = 296;
const PANEL_HEIGHT = 480;

export function TaskStatusPicker({
  scope,
  value,
  onChange,
}: {
  scope: TaskScope;
  value: string;
  onChange: (statusId: string) => void;
}) {
  const editor = useStatusEditor(scope);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"pick" | "manage">("pick");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setView("pick");
    triggerRef.current?.focus();
  };
  const position = useMenuPopover({
    open,
    triggerRef,
    panelRef,
    height: PANEL_HEIGHT,
    width: PANEL_WIDTH,
    onDismiss: close,
  });

  const current = editor.statuses.find((status) => status.id === value);
  const canManage = scope.canManageProperties;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Status: ${current?.name ?? "not set"}`}
        onClick={() => (open ? close() : setOpen(true))}
        className="flex h-9 w-full min-w-0 items-center rounded-sm px-2.5 text-left transition-colors duration-100 ease-standard hover:bg-surface-hover"
      >
        {current ? (
          <TaskStatusChip status={current} />
        ) : (
          <span className="text-sm text-text-subtle">Choose a status</span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          popover="manual"
          role="dialog"
          aria-label={view === "pick" ? "Choose a status" : "Manage statuses"}
          className="fixed inset-auto m-0 flex max-h-[30rem] flex-col rounded-md border border-border bg-surface shadow-overlay"
          style={{ top: position.top, left: position.left, width: PANEL_WIDTH }}
        >
          {view === "pick" ? (
            <TaskStatusSearchList
              statuses={editor.statuses}
              value={value}
              canCreate={canManage}
              pending={editor.isPending}
              onSelect={(statusId) => {
                onChange(statusId);
                close();
              }}
              onCreate={(name, group, color) =>
                editor.create(group, name, color, (created) => {
                  onChange(created.id);
                  close();
                })
              }
              onManage={canManage ? () => setView("manage") : undefined}
            />
          ) : (
            <div className="min-h-0 overflow-y-auto p-3">
              <TaskStatusManager
                editor={editor}
                onBack={() => setView("pick")}
                onDeleted={(deleted) => {
                  if (deleted.id !== value) return;
                  onChange(defaultStatusId(editor.statuses.filter((status) => status.id !== deleted.id)));
                }}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
