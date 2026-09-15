"use client";

import { useRef, useState } from "react";
import { useMenuPopover } from "@/components/projects/use-menu-popover";
import { ChevronDownIcon } from "@/components/ui/icons";

/**
 * One "set this on every selected task" menu in the bulk bar — a text trigger
 * ("Status") over a list of values.
 *
 * Not `SelectMenu`: that control shows the CURRENT value, and a selection has
 * no single current value. Not `ToolbarMenu`: its trigger is a 28px icon, and
 * four unlabelled icons in a bar that appears on demand would be a guessing
 * game. It borrows the part both get right — `useMenuPopover` for the top
 * layer, outside-click and Escape.
 *
 * Choosing applies immediately. The bar says what it will touch ("3 selected")
 * right beside it, and every bulk change is recorded in each task's history.
 */
export type BulkOption = { value: string; label: string; adornment?: React.ReactNode };

const PANEL_HEIGHT = 280;

export function TaskBulkMenu({
  label,
  options,
  disabled,
  onChoose,
}: {
  label: string;
  options: readonly BulkOption[];
  disabled?: boolean;
  onChoose: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };
  const position = useMenuPopover({ open, triggerRef, panelRef, height: PANEL_HEIGHT, width: 224, onDismiss: close });

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-7 items-center gap-1 rounded-sm px-2 text-xs font-medium text-text transition-colors duration-100 ease-standard hover:bg-surface-hover disabled:opacity-50"
      >
        {label}
        <ChevronDownIcon className="size-3 text-text-subtle" />
      </button>

      {open && (
        <div
          ref={panelRef}
          popover="manual"
          role="menu"
          aria-label={`Set ${label.toLowerCase()} for the selected tasks`}
          className="fixed inset-auto m-0 max-h-72 w-56 overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-overlay"
          style={{ top: position.top, left: position.left }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitem"
              onClick={() => {
                onChoose(option.value);
                close();
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-text-muted transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
            >
              {option.adornment}
              <span className="min-w-0 truncate">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
