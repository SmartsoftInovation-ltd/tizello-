"use client";

import { PropertyIcon, type PropertyIconKind } from "@/components/projects/property-icons";
import type { TaskDraft, TaskScope } from "@/components/tasks/task-draft";
import { TaskStatusPicker } from "@/components/tasks/task-status-picker";
import { DateField } from "@/components/ui/date-field";

/**
 * Status and Due, side by side under the title.
 *
 * No Assignee here on purpose. It used to sit in this row, but who does a
 * piece of work is a sprint-planning decision — made once the task is pulled
 * out of the backlog, not while it is still unstarted work in a flat list —
 * so it no longer shows in this drawer at all. `scope.members` stays on
 * `TaskScope` for whatever picks it back up.
 *
 * Label ABOVE the value here, unlike every `PropertyRow` below, because two
 * columns still don't leave room for a 7.5rem label beside the value.
 *
 * An unset value says what to do rather than "Empty" — "Set a due date" — so a
 * blank field reads as an invitation, not a gap.
 */
export function TaskTopFields({
  draft,
  errors,
  scope,
  onChange,
}: {
  draft: TaskDraft;
  errors: Record<string, string>;
  scope: TaskScope;
  onChange: (patch: Partial<TaskDraft>) => void;
}) {
  return (
    <div className="mt-5 grid gap-3 rounded-md border border-border p-1.5 sm:grid-cols-2 sm:gap-1">
      <TopField label="Status" icon="status">
        <TaskStatusPicker
          scope={scope}
          value={draft.statusId}
          onChange={(statusId) => onChange({ statusId })}
        />
      </TopField>

      <TopField label="Due" icon="calendar">
        <DateField
          label="Due date"
          hideLabel
          ghost
          placeholder="Set a due date"
          value={draft.dueDate}
          today={scope.today}
          error={errors.dueDate}
          onChange={(dueDate) => onChange({ dueDate })}
        />
      </TopField>
    </div>
  );
}

function TopField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: PropertyIconKind;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <span className="flex items-center gap-1.5 px-2.5 pt-1 text-xs text-text-subtle">
        <PropertyIcon kind={icon} />
        {label}
      </span>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
