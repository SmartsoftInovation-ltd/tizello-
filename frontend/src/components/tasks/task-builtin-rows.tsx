"use client";

import { FilesValueField } from "@/components/projects/files-value-field";
import { PRIORITY_CHIP } from "@/components/projects/project-tone";
import { PropertyRow } from "@/components/projects/property-row";
import { SelectMenu, type SelectOption } from "@/components/projects/select-menu";
import type { TaskDraft, TaskScope } from "@/components/tasks/task-draft";
import { TaskTagsField } from "@/components/tasks/task-tags-field";
import { TaskTypeIcon } from "@/components/tasks/task-type-icon";
import { TextArea } from "@/components/ui/text-area";
import { StoryPointsChoices } from "@/components/tasks/story-points-choices";
import { cn } from "@/lib/cn";
import {
  PROJECT_PRIORITIES,
  PROJECT_PRIORITY_LABEL,
  type ProjectPriority,
} from "@/types/project";
import type { UploadedFile } from "@/types/project-property";
import { TASK_TYPES, TASK_TYPE_LABEL, type Task, type TaskType } from "@/types/task";

/**
 * The task's own fields: Type, Sprint, Priority, Story points, Tags,
 * Description and Files & media.
 *
 * A function returning rows, not a component, because `TaskPropertyList` needs
 * to know which rows are EMPTY before it decides which to draw. Nothing here
 * holds state; every control is fed from the draft.
 *
 * WHAT IS DELIBERATELY NOT HERE, and why each went:
 *
 * - **ID** — the key is already in the drawer's header; on a new task the row
 *   could only say "Assigned when created".
 * - **Icon and Colour** — decoration no one triages by, drawn in a row that
 *   competed with priority and tags for colour. The title's mark is the TYPE
 *   now, which carries meaning.
 * - **Delay** — derived from Due, and the backlog row already says "Overdue".
 * - **Parent-task** — lives in Relations with the sub-tasks, so the hierarchy
 *   is in one place (`task-relations.tsx`).
 *
 * **Sprint** is back now that sprints are real: it offers the backlog and every
 * sprint not yet completed, and saving moves the task (and its sub-tasks) there.
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

const TYPE_OPTIONS: readonly SelectOption<TaskType>[] = TASK_TYPES.map((value) => ({
  value,
  label: TASK_TYPE_LABEL[value],
  adornment: <TaskTypeIcon type={value} />,
}));

export function taskBuiltinRows(input: {
  task: Task | null;
  draft: TaskDraft;
  scope: TaskScope;
  onChange: (patch: Partial<TaskDraft>) => void;
}): TaskRow[] {
  const { draft, scope, onChange } = input;
  const sprintOptions: SelectOption<string>[] = [
    { value: "", label: "Backlog" },
    ...scope.sprints
      .filter((sprint) => sprint.state !== "COMPLETED")
      .map((sprint) => ({ value: sprint.id, label: sprint.state === "ACTIVE" ? `${sprint.name} (active)` : sprint.name })),
  ];

  return [
    {
      key: "type",
      empty: false,
      node: (
        <PropertyRow label="Type" icon="type">
          <SelectMenu label="Type" value={draft.type} options={TYPE_OPTIONS} onChange={(type) => onChange({ type })} />
        </PropertyRow>
      ),
    },
    {
      key: "sprint",
      empty: !draft.sprintId,
      node: (
        <PropertyRow label="Sprint" icon="sprint">
          <SelectMenu label="Sprint" value={draft.sprintId} options={sprintOptions} onChange={(sprintId) => onChange({ sprintId })} />
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
      key: "points",
      empty: !draft.storyPoints,
      node: (
        <PropertyRow label="Story points" icon="points">
          <div className="px-1.5 py-1">
            <StoryPointsChoices
              value={draft.storyPoints ? Number(draft.storyPoints) : null}
              onChange={(points) => onChange({ storyPoints: points === null ? "" : String(points) })}
            />
          </div>
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
    {
      key: "files",
      empty: draft.attachments.length === 0,
      node: (
        <PropertyRow label="Files & media" icon="files">
          <FilesValueField
            value={draft.attachments}
            onChange={(value) => onChange({ attachments: value as UploadedFile[] })}
          />
        </PropertyRow>
      ),
    },
  ];
}
