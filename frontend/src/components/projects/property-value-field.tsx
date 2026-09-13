"use client";

import { FilesValueField } from "@/components/projects/files-value-field";
import { SelectMenu } from "@/components/projects/select-menu";
import { DateField } from "@/components/ui/date-field";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import {
  type ProjectPropertyDef,
  type PropertyValue,
} from "@/types/project-property";

/**
 * The control for one property's value, chosen by its definition's type.
 *
 * A switch rather than a lookup object so TypeScript checks exhaustiveness —
 * adding a tenth type to `PROPERTY_TYPES` without a branch here is a build
 * error, not a row that silently renders nothing.
 *
 * Every branch is CONTROLLED, unlike most fields in this app. The value comes
 * from a map keyed by definition id, and an uncontrolled field seeded by
 * `defaultValue` would not update when a property is removed and re-added
 * within one drawer session.
 *
 * `NUMBER` keeps its own string state in the parent rather than here: a
 * controlled numeric input that coerces on every keystroke makes "1.", "-" and
 * "1e" unreachable, so the raw string is what is edited and the coercion
 * happens once, in `ProjectPropertyRow`.
 */
export function PropertyValueField({
  definition,
  value,
  today,
  onChange,
}: {
  /* Structural, not the full record — see `custom-property-row.tsx`. */
  definition: Pick<ProjectPropertyDef, "id" | "name" | "type" | "options">;
  value: PropertyValue;
  today: string;
  onChange: (value: PropertyValue) => void;
}) {
  const options = definition.options ?? [];

  switch (definition.type) {
    case "CHECKBOX":
      return (
        <label className="flex h-9 items-center gap-2 px-2.5">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
            className="size-4 accent-brand-500"
          />
          <span className="text-sm text-text-muted">
            {value === true ? "Yes" : "No"}
          </span>
        </label>
      );

    case "DATE":
      return (
        <DateField
          label={definition.name}
          hideLabel
          ghost
          placeholder="Pick a date"
          value={typeof value === "string" ? value : ""}
          today={today}
          onChange={(next) => onChange(next)}
        />
      );

    case "SELECT":
      return (
        <SelectMenu
          label={definition.name}
          value={typeof value === "string" ? value : ""}
          /* The empty option is what makes "no choice" reachable again after
             one has been made — without it a SELECT can never go back to
             unset short of removing the whole row. */
          options={[
            { value: "", label: "None" },
            ...options.map((option) => ({
              value: option.id,
              label: option.label,
              adornment: option.color ? <OptionSwatch color={option.color} /> : undefined,
            })),
          ]}
          onChange={(next) => onChange(next)}
        />
      );

    case "MULTI_SELECT": {
      /* Narrowed to strings: `PropertyValue`'s array arm is a union with
         `UploadedFile[]`, and a MULTI_SELECT holds option ids. */
      const selected = (Array.isArray(value) ? value : []).filter(
        (entry): entry is string => typeof entry === "string",
      );
      return (
        <div className="flex flex-wrap gap-1 rounded-sm border border-transparent p-1.5 transition-colors duration-100 ease-standard hover:bg-surface-hover">
          {options.length === 0 && (
            <span className="px-1 py-0.5 text-2xs text-text-subtle">
              No options defined yet
            </span>
          )}
          {options.map((option) => {
            const on = selected.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange(
                    on
                      ? selected.filter((entry) => entry !== option.id)
                      : [...selected, option.id],
                  )
                }
                className={cn(
                  "rounded-xs px-1.5 py-0.5 text-2xs font-medium transition-colors duration-100 ease-standard",
                  on
                    ? "bg-brand-100 text-brand-800"
                    : "border border-border text-text-muted hover:bg-surface-hover",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      );
    }

    case "FILES":
      return (
        <FilesValueField
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
        />
      );

    /* TEXT, NUMBER, URL, EMAIL and PHONE are all one-line text inputs. `type`
       is left as "text" for URL and EMAIL on purpose: the browser's own
       validation bubble fires on submit and would compete with the API's `422`,
       which is the one that actually decides. */
    default:
      return (
        <TextField
          label={definition.name}
          hideLabel
          ghost
          name={definition.id}
          autoComplete="off"
          required={false}
          placeholder="Add a value…"
          value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
          onValueChange={(next) => onChange(next)}
        />
      );
  }
}

/** An option's own colour, when the definition gave it one. Decorative — the label sits beside it. */
function OptionSwatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-2.5 shrink-0 rounded-full border border-border"
      style={{ backgroundColor: color }}
    />
  );
}
