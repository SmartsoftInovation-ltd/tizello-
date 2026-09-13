"use client";

import { PropertyIcon, type PropertyIconKind } from "@/components/projects/property-icons";
import { TaskAssigneePicker } from "@/components/tasks/task-assignee-picker";
import type { TaskDraft, TaskScope } from "@/components/tasks/task-draft";
import { TaskStatusPicker } from "@/components/tasks/task-status-picker";
import { DateField } from "@/components/ui/date-field";

/**
 * Assignee, Status and Due, side by side under the title.
 *
 * These three sit apart from the property list because they are the three a
 * glance at a task is looking for — who, how far along, by when — and Notion's
 * task template gives them the same headline row. Label ABOVE the value here,
 * unlike every `PropertyRow` below, because three columns of 7.5rem labels
 * would leave no room for the values.
 *
 * An unset value says what to do rather than "Empty" — "Assign someone", "Set a
 * due date" — so a blank field reads as an invitation, not a gap.
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
    <div className="mt-5 grid gap-3 rounded-md border border-border p-1.5 sm:grid-cols-3 sm:gap-1">
      <TopField label="Assignee" icon="people">
        <TaskAssigneePicker
          members={scope.members}
          value={draft.assigneeId}
          onChange={(assigneeId) => onChange({ assigneeId })}
        />
      </TopField>

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
