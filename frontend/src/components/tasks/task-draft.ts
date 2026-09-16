import type { TaskInput, TaskPatch } from "@/lib/tasks";
import type { WorkspaceMemberRow } from "@/lib/workspaces";
import type { ProjectPriority } from "@/types/project";
import type { ProjectPropertyPatch, UploadedFile } from "@/types/project-property";
import type { ProjectSprint } from "@/types/project-sprint";
import type { Task, TaskPropertyDef, TaskStatusOption, TaskType } from "@/types/task";

/*
 * What the task drawer edits, and how an edit becomes a request.
 *
 * Flat and all-strings, because that is what a form holds: `""` is "empty" for
 * every optional field, dates are `YYYY-MM-DD`, and `priority` is `""` rather
 * than `null` so a `SelectMenu` can offer "Empty" as an ordinary option.
 * `storyPoints` is a string for the same reason — `""` is "not estimated",
 * which must not collapse into `0`.
 *
 * `icon` and `color` stay in the draft with no control in the drawer: the
 * columns still exist, and carrying the stored values through is what keeps a
 * Save from clearing a glyph set before those rows were removed.
 *
 * Pure functions with no component around them, like `edit-project-diff.ts` —
 * a diff is the kind of logic worth reading on its own.
 */

export type TaskDraft = {
  title: string;
  description: string;
  type: TaskType;
  storyPoints: string;
  icon: string;
  color: string;
  statusId: string;
  priority: ProjectPriority | "";
  /** User ids, in the order they were assigned. */
  assigneeIds: string[];
  dueDate: string;
  completedAt: string;
  tags: string[];
  attachments: UploadedFile[];
  parentId: string;
  /** `""` is the backlog. */
  sprintId: string;
};

/**
 * Everything the drawer needs from the page, as one prop — the same bargain
 * `ProjectScope` strikes. The backlog is several levels above every control
 * that reads these.
 */
export type TaskScope = {
  workspaceId: string;
  projectId: string;
  projectName: string;
  /** `YYYY-MM-DD`, resolved on the server. */
  today: string;
  currentUserId: string;
  /** The workspace roster — who a task can be assigned to. */
  members: WorkspaceMemberRow[];
  /** This project's task columns. */
  definitions: TaskPropertyDef[];
  /** This project's Status options, ordered by group then position. */
  statuses: TaskStatusOption[];
  /** This project's sprints, any state — pickers offer the ones not completed. */
  sprints: ProjectSprint[];
  /** Project writer: may add and delete task columns and statuses. Drawn only — the API enforces. */
  canManageProperties: boolean;
  /** Project member or workspace admin: may create and edit tasks. */
  canContribute: boolean;
};

const day = (iso: string | null) => iso?.slice(0, 10) ?? "";

/** `seed` fills what a NEW task starts with — the default status, and a parent when adding a sub-task. */
export function draftFromTask(
  task: Task | null,
  seed: { parentId?: string; statusId?: string; sprintId?: string } = {},
): TaskDraft {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    type: task?.type ?? "TASK",
    storyPoints: task?.storyPoints == null ? "" : String(task.storyPoints),
    icon: task?.icon ?? "",
    color: task?.color ?? "",
    statusId: task?.statusId ?? seed.statusId ?? "",
    priority: task?.priority ?? "",
    assigneeIds: task?.assignees.map((person) => person.id) ?? [],
    dueDate: day(task?.dueDate ?? null),
    completedAt: day(task?.completedAt ?? null),
    tags: task?.tags ?? [],
    attachments: task?.attachments ?? [],
    parentId: task?.parentId ?? seed.parentId ?? "",
    sprintId: task?.sprintId ?? seed.sprintId ?? "",
  };
}

/**
 * Whether a property value is "nothing". `false` counts: an unticked box is the
 * absence of a tick. `0` does not — nought is a figure somebody entered.
 */
export function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    value === false ||
    (Array.isArray(value) && value.length === 0)
  );
}

/*
 * An emptied custom value is never SENT as `""`: a DATE property's rule is
 * "must be a date", so an empty string is a `422` for a field the user only
 * cleared. On create it is omitted; on edit it becomes `null`, which is how the
 * API deletes a value.
 */
function filledProperties(properties: ProjectPropertyPatch): ProjectPropertyPatch {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => !isEmptyValue(value)),
  );
}

/** A create sends only what was filled in — the API validates present fields, so `""` would be a `400`. */
export function createInput(draft: TaskDraft, raw: ProjectPropertyPatch): TaskInput {
  const properties = filledProperties(raw);

  return {
    title: draft.title.trim(),
    ...(draft.statusId ? { statusId: draft.statusId } : {}),
    ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
    ...(draft.type !== "TASK" ? { type: draft.type } : {}),
    ...(draft.storyPoints ? { storyPoints: Number(draft.storyPoints) } : {}),
    ...(draft.icon ? { icon: draft.icon } : {}),
    ...(draft.color ? { color: draft.color } : {}),
    ...(draft.priority ? { priority: draft.priority } : {}),
    ...(draft.assigneeIds.length > 0 ? { assigneeIds: draft.assigneeIds } : {}),
    ...(draft.dueDate ? { dueDate: draft.dueDate } : {}),
    ...(draft.completedAt ? { completedAt: draft.completedAt } : {}),
    ...(draft.tags.length > 0 ? { tags: draft.tags } : {}),
    ...(draft.attachments.length > 0 ? { attachments: draft.attachments } : {}),
    ...(draft.parentId ? { parentId: draft.parentId } : {}),
    ...(draft.sprintId ? { sprintId: draft.sprintId } : {}),
    ...(Object.keys(properties).length > 0 ? { properties } : {}),
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Only what changed, with `null` for a field that was emptied.
 *
 * Sending the whole row would clobber a field a teammate changed in between,
 * and would make every open-and-close a write. `JSON.stringify` rather than
 * `===` because tags, attachments and multi-select values are arrays.
 */
export function taskPatch(
  task: Task,
  draft: TaskDraft,
  properties: ProjectPropertyPatch,
): TaskPatch {
  const stored = draftFromTask(task);
  const patch: TaskPatch = {};
  const orNull = (value: string) => value || null;

  if (draft.title.trim() !== stored.title) patch.title = draft.title.trim();
  if (draft.description.trim() !== stored.description) {
    patch.description = orNull(draft.description.trim());
  }
  if (draft.type !== stored.type) patch.type = draft.type;
  if (draft.storyPoints !== stored.storyPoints) {
    patch.storyPoints = draft.storyPoints ? Number(draft.storyPoints) : null;
  }
  if (draft.icon !== stored.icon) patch.icon = orNull(draft.icon);
  if (draft.color !== stored.color) patch.color = orNull(draft.color);
  if (draft.statusId && draft.statusId !== stored.statusId) patch.statusId = draft.statusId;
  if (draft.priority !== stored.priority) patch.priority = draft.priority || null;
  if (!same(draft.assigneeIds, stored.assigneeIds)) patch.assigneeIds = draft.assigneeIds;
  if (draft.dueDate !== stored.dueDate) patch.dueDate = orNull(draft.dueDate);
  if (draft.completedAt !== stored.completedAt) patch.completedAt = orNull(draft.completedAt);
  if (draft.parentId !== stored.parentId) patch.parentId = orNull(draft.parentId);
  if (draft.sprintId !== stored.sprintId) patch.sprintId = orNull(draft.sprintId);
  if (!same(draft.tags, stored.tags)) patch.tags = draft.tags;
  if (!same(draft.attachments, stored.attachments)) patch.attachments = draft.attachments;

  const changed: ProjectPropertyPatch = {};
  for (const [id, value] of Object.entries(properties)) {
    const before = task.properties[id];
    if (isEmptyValue(value)) {
      if (!isEmptyValue(before)) changed[id] = null;
    } else if (!same(before, value)) {
      changed[id] = value;
    }
  }
  if (Object.keys(changed).length > 0) patch.properties = changed;

  return patch;
}

/** A roster row's display name — the address's local part for an account that never set one. */
export function memberName(member: WorkspaceMemberRow | undefined): string {
  if (!member?.user) return "Unknown member";
  return member.user.name ?? member.user.email.split("@")[0];
}
