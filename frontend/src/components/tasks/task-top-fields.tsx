"use client";

import { PropertyIcon, type PropertyIconKind } from "@/components/projects/property-icons";
import { TaskAssigneePicker } from "@/components/tasks/task-assignee-picker";
import type { TaskDraft, TaskScope } from "@/components/tasks/task-draft";
import { TaskStatusPicker } from "@/components/tasks/task-status-picker";
import { DateField } from "@/components/ui/date-field";

/**
 * Status, Assignee and Due, side by side under the title — the three things
 * someone scanning a task wants first: where it is, who has it, when it is due.
 *
 * ASSIGNEE IS BACK, and the reason it was taken out no longer holds. It was
 * removed on the grounds that assigning is a sprint-planning decision — but
 * sprint planning is still fixture-backed, so with it gone nothing in the real
 * app could set an assignee at all, while the backlog row went on drawing one.
 * Teams also routinely assign backlog work ("Sam will pick this up"). If
 * planning later becomes the main place to assign, this stays as the edit path.
 *
 * Label ABOVE the value here, unlike every `PropertyRow` below, because three
 * columns don't leave room for a 7.5rem label beside the value.
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
    <div className="mt-5 grid gap-3 rounded-md border border-border p-1.5 sm:grid-cols-3 sm:gap-1">
      <TopField label="Status" icon="status">
        <TaskStatusPicker
          scope={scope}
          value={draft.statusId}
          onChange={(statusId) => onChange({ statusId })}
        />
      </TopField>

      <TopField label="Assignee" icon="people">
        <TaskAssigneePicker
          members={scope.members}
          value={draft.assigneeId}
          onChange={(assigneeId) => onChange({ assigneeId })}
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
