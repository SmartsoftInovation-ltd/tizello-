"use client";

import { useState } from "react";
import { PropertyTypeIcon } from "@/components/projects/property-type-icons";
import { PropertyValueField } from "@/components/projects/property-value-field";
import {
  PROPERTY_TYPE_LABEL,
  type ProjectPropertyDef,
  type PropertyValue,
} from "@/types/project-property";

/**
 * One custom property, as a `label — value` line.
 *
 * `onDeleteDefinition` is the workspace-admin action and is deliberately NOT
 * the same control as clearing a value: clearing empties this project's cell,
 * deleting removes the column from every project in the workspace. Two
 * outcomes that far apart must not share a ✕. Clearing is what the value
 * control itself does (an empty string, an unticked box); deleting is the
 * trash affordance, and only appears for someone who may actually do it.
 *
 * NUMBER keeps a local string draft. A controlled numeric input that coerces
 * on every keystroke makes "1.", "-" and "1e" unreachable — the raw string is
 * what is edited, and the coercion happens on blur.
 */
export function CustomPropertyRow({
  definition,
  value,
  today,
  canManage,
  onChange,
  onDeleteDefinition,
}: {
  /* Only the four fields a row reads, so a project's TASK column
     (`TaskPropertyDef`, scoped to a project rather than a workspace) draws
     through the same row. */
  definition: Pick<ProjectPropertyDef, "id" | "name" | "type" | "options">;
  value: PropertyValue | undefined;
  today: string;
  canManage: boolean;
  onChange: (value: PropertyValue) => void;
  onDeleteDefinition: () => void;
}) {
  const isNumber = definition.type === "NUMBER";
  const [draft, setDraft] = useState(
    value === undefined || value === null ? "" : String(value),
  );

  return (
    <div className="group grid grid-cols-[7.5rem_1fr] items-start gap-2 py-1">
      <span
        className="flex items-center gap-1.5 pt-2 text-xs text-text-subtle"
        title={PROPERTY_TYPE_LABEL[definition.type]}
      >
        <PropertyTypeIcon type={definition.type} />
        <span className="min-w-0 truncate">{definition.name}</span>
      </span>

      <div className="flex min-w-0 items-start gap-1">
        <div className="min-w-0 flex-1">
          {isNumber ? (
            <input
              inputMode="decimal"
              aria-label={definition.name}
              placeholder="Add a number"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              /* Coerced once, on blur. An empty field is 0 rather than a
                 removed key: removing is the trash control above, and a field
                 someone cleared by hand should not silently delete a column's
                 value for this project. */
              onBlur={() => {
                const parsed = Number(draft);
                onChange(draft.trim() === "" || Number.isNaN(parsed) ? 0 : parsed);
              }}
              className="h-9 w-full rounded-sm border border-transparent bg-transparent px-2.5 text-sm text-text transition-colors duration-100 ease-standard placeholder:text-text-subtle hover:bg-surface-hover"
            />
          ) : (
            <PropertyValueField
              definition={definition}
              value={value ?? ""}
              today={today}
              onChange={onChange}
            />
          )}
        </div>

        {canManage && (
          <button
            type="button"
            onClick={onDeleteDefinition}
            aria-label={`Delete the ${definition.name} property from this workspace`}
            /* Revealed on hover AND on keyboard focus — `group-hover` alone
               leaves it unreachable by keyboard, since focus does not imply
               hover. */
            className="mt-1 grid size-7 shrink-0 place-items-center rounded-sm text-text-subtle opacity-0 transition-opacity duration-100 ease-standard group-hover:opacity-100 hover:bg-surface-hover hover:text-danger focus-visible:opacity-100"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
              <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 8.5h6l.5-8.5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
