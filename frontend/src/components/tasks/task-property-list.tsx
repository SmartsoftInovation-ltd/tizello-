"use client";

import { Fragment, useState } from "react";
import { CustomPropertyRow } from "@/components/projects/custom-property-row";
import { TaskAddPropertyMenu } from "@/components/tasks/task-add-property-menu";
import { taskBuiltinRows, type TaskRow } from "@/components/tasks/task-builtin-rows";
import {
  isEmptyValue,
  type TaskDraft,
  type TaskScope,
} from "@/components/tasks/task-draft";
import { useTaskPropertyDefs } from "@/components/tasks/use-task-property-defs";
import { ChevronDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { ProjectPropertyPatch, PropertyValue } from "@/types/project-property";
import type { Task } from "@/types/task";

/**
 * The Properties block: the task's own fields, then this project's custom
 * columns, then "+ Add a property" and "Hide N properties".
 *
 * EVERY ROW IS DRAWN ON OPEN, EMPTY ONES INCLUDED — the same call
 * `shownPropertiesFor` makes for projects. A new task is a form someone is
 * about to fill in, and hiding Description behind a toggle hides the first
 * thing they want to type. "Hide" is for a task that is mostly filled in and
 * whose blanks are now noise; it hides only rows with nothing in them, and the
 * count on the button says how many.
 *
 * Rows arrive as `{ key, empty, node }` rather than as JSX in a fixed order, so
 * hiding is a filter over one list instead of a condition on twelve rows.
 */
export function TaskPropertyList({
  task,
  draft,
  properties,
  scope,
  onChange,
  onPropertiesChange,
}: {
  task: Task | null;
  draft: TaskDraft;
  properties: ProjectPropertyPatch;
  scope: TaskScope;
  onChange: (patch: Partial<TaskDraft>) => void;
  onPropertiesChange: (patch: ProjectPropertyPatch) => void;
}) {
  const [hideEmpty, setHideEmpty] = useState(false);
  const schema = useTaskPropertyDefs(scope);

  const rows: TaskRow[] = [
    ...taskBuiltinRows({ task, draft, scope, onChange }),
    ...schema.defs.map((definition) => ({
      key: definition.id,
      empty: isEmptyValue(properties[definition.id]),
      node: (
        <CustomPropertyRow
          definition={definition}
          value={(properties[definition.id] ?? undefined) as PropertyValue | undefined}
          today={scope.today}
          canManage={scope.canManageProperties}
          onChange={(value) => onPropertiesChange({ [definition.id]: value })}
          onDeleteDefinition={() => schema.remove(definition)}
        />
      ),
    })),
  ];

  const emptyCount = rows.filter((row) => row.empty).length;
  const visible = hideEmpty ? rows.filter((row) => !row.empty) : rows;

  return (
    <section className="mt-6" aria-label="Properties">
      <h3 className="px-0.5 text-xs font-medium text-text-subtle">Properties</h3>

      <div className="mt-2">
        {visible.map((row) => (
          <Fragment key={row.key}>{row.node}</Fragment>
        ))}
      </div>

      <TaskAddPropertyMenu
        canManage={scope.canManageProperties}
        pending={schema.isPending}
        error={schema.error}
        onCreate={schema.create}
      />

      {emptyCount > 0 && (
        <button
          type="button"
          aria-pressed={hideEmpty}
          onClick={() => setHideEmpty((state) => !state)}
          className="mt-0.5 flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs text-text-subtle transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
        >
          <ChevronDownIcon
            className={cn("size-3.5 transition-transform", hideEmpty ? "" : "rotate-180")}
          />
          {hideEmpty
            ? `Show ${emptyCount} empty ${emptyCount === 1 ? "property" : "properties"}`
            : `Hide ${emptyCount} empty ${emptyCount === 1 ? "property" : "properties"}`}
        </button>
      )}
    </section>
  );
}
