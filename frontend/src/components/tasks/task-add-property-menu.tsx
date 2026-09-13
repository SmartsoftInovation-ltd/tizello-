"use client";

import { useRef, useState } from "react";
import { MenuItem, MenuLabel } from "@/components/projects/menu-primitives";
import { PropertyTypeIcon } from "@/components/projects/property-type-icons";
import { useMenuPopover } from "@/components/projects/use-menu-popover";
import { PlusIcon } from "@/components/ui/icons";
import { TextField } from "@/components/ui/text-field";
import {
  PROPERTY_TYPES,
  PROPERTY_TYPE_HINT,
  PROPERTY_TYPE_LABEL,
  type PropertyType,
} from "@/types/project-property";

/**
 * "+ Add a property" for a project's tasks — a new COLUMN, named and typed.
 *
 * The task's own fields are all drawn already (`task-builtin-rows.tsx`), so
 * unlike the project menu there is no "Project fields" section to reveal; this
 * is only the schema half. Picking a type submits, exactly as the project menu
 * does — the name is already typed and the type is the last decision.
 *
 * Absent entirely for someone who may not change the schema, rather than
 * shown disabled: a control that can only ever refuse is worse than none.
 */
const PANEL_WIDTH = 272;
const PANEL_HEIGHT = 448;

export function TaskAddPropertyMenu({
  canManage,
  pending,
  error,
  onCreate,
}: {
  canManage: boolean;
  pending: boolean;
  error?: string;
  onCreate: (input: { name: string; type: PropertyType }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const position = useMenuPopover({
    open,
    triggerRef,
    panelRef,
    height: PANEL_HEIGHT,
    onDismiss: () => {
      setOpen(false);
      triggerRef.current?.focus();
    },
  });

  if (!canManage) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((state) => !state)}
        className="mt-1 flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs text-text-subtle transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
      >
        <PlusIcon className="size-3.5" />
        Add a property
      </button>

      {open && (
        <div
          ref={panelRef}
          popover="manual"
          role="dialog"
          aria-label="Add a property"
          className="fixed inset-auto m-0 flex max-h-[28rem] flex-col rounded-md border border-border bg-surface p-1 shadow-overlay"
          style={{ top: position.top, left: position.left, width: PANEL_WIDTH }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <MenuLabel>New task property</MenuLabel>
            <div className="px-1 pb-1">
              <TextField
                label="Property name"
                name="taskPropertyName"
                autoComplete="off"
                required={false}
                placeholder="Property name"
                error={error}
                onValueChange={setName}
                /* Inside the drawer's form — Enter must not save the task. */
                onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
              />
            </div>
            {PROPERTY_TYPES.map((type) => (
              <MenuItem
                key={type}
                icon={<PropertyTypeIcon type={type} />}
                label={PROPERTY_TYPE_LABEL[type]}
                hint={PROPERTY_TYPE_HINT[type]}
                disabled={pending}
                onClick={() => {
                  onCreate({ name: name.trim() || PROPERTY_TYPE_LABEL[type], type });
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
