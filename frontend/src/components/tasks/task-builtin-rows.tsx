"use client";

import { ColorRowControl } from "@/components/projects/color-row-control";
import { IconRowControl } from "@/components/projects/icon-row-control";
import { PRIORITY_CHIP } from "@/components/projects/project-tone";
import { PropertyRow } from "@/components/projects/property-row";
import { SelectMenu, type SelectOption } from "@/components/projects/select-menu";
import type { TaskDraft, TaskScope } from "@/components/tasks/task-draft";
import { taskScheduleRows } from "@/components/tasks/task-schedule-rows";
import { TaskTagsField } from "@/components/tasks/task-tags-field";
import { TextArea } from "@/components/ui/text-area";
import { cn } from "@/lib/cn";
import {
  PROJECT_PRIORITIES,
  PROJECT_PRIORITY_LABEL,
  type ProjectPriority,
} from "@/types/project";
import type { Task } from "@/types/task";

/**
 * The task's own fields, in the order the Notion template lists them: ID,
 * Sprint, Priority, Tags, Description — then, from `task-schedule-rows.tsx`,
 * Files & media, Completed on, Delay and Parent-task.
 *
 * A function returning rows, not a component, because `TaskPropertyList` needs
 * to know which rows are EMPTY before it decides which to draw. Nothing here
 * holds state; every control is fed from the draft.
 *
 * Two rows here are read-only, each for its own reason:
 * - **ID** is allocated by the server on create and never changes after.
 * - **Sprint** has no model behind it yet. A backlog task is by definition in
 *   no sprint (`.claude/rules/workflow.md`); planning is what will set it.
 */
export type TaskRow = { key: string; empty: boolean; node: React.ReactNode };

const PRIORITY_OPTIONS: readonly SelectOption<ProjectPriority | "">[] = [
  { value: "", label: "No priority" },
  ...PROJECT_PRIORITIES.map((value) => ({
    value,
    label: PROJECT_PRIORITY_LABEL[value],
    adornment: (
      <span
        aria-hidden="true"
        className={cn("inline-block size-3 shrink-0 rounded-xs", PRIORITY_CHIP[value])}
      />
    ),
  })),
];

export function taskBuiltinRows(input: {
  task: Task | null;
  draft: TaskDraft;
  scope: TaskScope;
  tasks: Task[];
  onChange: (patch: Partial<TaskDraft>) => void;
}): TaskRow[] {
  const { task, draft, onChange } = input;

  return [
    {
      key: "id",
      empty: false,
      node: (
        <PropertyRow label="ID" icon="hash">
          <p className="px-2.5 py-2 font-mono text-sm text-text-muted">
            {task?.key ?? "Assigned when created"}
          </p>
        </PropertyRow>
      ),
    },
    {
      key: "sprint",
      empty: true,
      node: (
        <PropertyRow label="Sprint" icon="sprint">
          <p className="px-2.5 py-2 text-sm text-text-subtle">Not in a sprint</p>
        </PropertyRow>
      ),
    },
    {
      key: "priority",
      empty: !draft.priority,
      node: (
        <PropertyRow label="Priority" icon="flag">
          <SelectMenu
            label="Priority"
            value={draft.priority}
            options={PRIORITY_OPTIONS}
            onChange={(priority) => onChange({ priority })}
          />
        </PropertyRow>
      ),
    },
    {
      key: "tags",
      empty: draft.tags.length === 0,
      node: (
        <PropertyRow label="Tags" icon="tag">
          <TaskTagsField tags={draft.tags} onChange={(tags) => onChange({ tags })} />
        </PropertyRow>
      ),
    },
    {
      key: "icon",
      empty: !draft.icon,
      node: (
        <PropertyRow label="Icon" icon="emoji">
          <IconRowControl icon={draft.icon} onChange={(icon) => onChange({ icon })} />
        </PropertyRow>
      ),
    },
    {
      key: "color",
      empty: !draft.color,
      node: (
        <PropertyRow label="Colour" icon="palette">
          <ColorRowControl color={draft.color} onChange={(color) => onChange({ color })} />
        </PropertyRow>
      ),
    },
    {
      key: "description",
      empty: !draft.description.trim(),
      node: (
        <PropertyRow label="Description" icon="text">
          <TextArea
            label="Description"
            hideLabel
            ghost
            rows={3}
            name="description"
            defaultValue={draft.description}
            placeholder="Add a description…"
            maxLength={5000}
            onValueChange={(description) => onChange({ description })}
          />
        </PropertyRow>
      ),
    },
    ...taskScheduleRows(input),
  ];
}
