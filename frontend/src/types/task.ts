import type { ProjectPriority } from "@/types/project";
import type {
  PropertyOption,
  PropertyType,
  ProjectPropertyValues,
  UploadedFile,
} from "@/types/project-property";

/*
 * The task domain, mirroring `backend/docs/api/task.md`.
 *
 * WHY THIS IS NOT `BacklogTask` FROM `backlog.ts`
 * -----------------------------------------------
 * `backlog.ts` is the fixture shape the sprint-planning and sprint-board
 * screens still render. This file holds the RECORD the API actually returns.
 *
 * STATUSES ARE DATA, NOT AN ENUM. Each project defines its own — "Re-open",
 * "Dev done", "QA passed" — the way a Notion database does, and each status
 * belongs to one of three fixed GROUPS. The group is what the rest of the app
 * reasons about (a status in Complete stamps Completed on; the sprint board's
 * three columns will be the three groups), so a team can name its workflow
 * anything without breaking either.
 */

/** Declaration order is display order — the API sorts by it too. */
export const TASK_STATUS_GROUPS = ["TODO", "IN_PROGRESS", "COMPLETE"] as const;
export type TaskStatusGroup = (typeof TASK_STATUS_GROUPS)[number];

export const TASK_STATUS_GROUP_LABEL: Record<TaskStatusGroup, string> = {
  TODO: "To-do",
  IN_PROGRESS: "In Progress",
  COMPLETE: "Complete",
};

/** Notion's nine. Names, not hex — the palette is the design system's to decide. */
export const STATUS_COLORS = [
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
] as const;
export type StatusColor = (typeof STATUS_COLORS)[number];

export const STATUS_COLOR_LABEL: Record<StatusColor, string> = {
  gray: "Gray",
  brown: "Brown",
  orange: "Orange",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  purple: "Purple",
  pink: "Pink",
  red: "Red",
};

/** What kind of work a task is. Fixed across projects, unlike statuses. Order is display order. */
export const TASK_TYPES = ["TASK", "STORY", "BUG", "EPIC"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  TASK: "Task",
  STORY: "Story",
  BUG: "Bug",
  EPIC: "Epic",
};

/** The API's ceiling for an estimate — `task.validator.js`. */
export const STORY_POINTS_MAX = 100;

/** A status as a task carries it — enough to draw the chip and know the group. */
export type TaskStatusRef = {
  id: string;
  name: string;
  color: StatusColor;
  group: TaskStatusGroup;
};

/** One option of a project's Status property, as `GET /projects/:id/task-statuses` returns it. */
export type TaskStatusOption = TaskStatusRef & {
  projectId: string;
  /** Sparse, and only meaningful WITHIN the group. */
  position: number;
  /** Exactly one per project: where a new task starts, and where a deleted status's tasks go. */
  isDefault: boolean;
  /** Live tasks on this status — what a delete would move. */
  taskCount: number;
  createdAt: string;
  updatedAt: string;
};

/** A person as a task carries them — whitelisted to three fields by the API. */
export type TaskPerson = { id: string; name: string | null; email: string };

/** The parent a sub-task points at: enough to draw `TIZ-4 Title` and open it. */
export type TaskRef = { id: string; number: number; key: string; title: string };

/** One task, exactly as `GET /tasks/:id` returns it. */
export type Task = {
  id: string;
  projectId: string;
  /** Per-project sequence — never reused, even after a delete. */
  number: number;
  /** `"TIZ-12"`: the project key plus `number`. What every row and header shows. */
  key: string;
  title: string;
  description: string | null;
  type: TaskType;
  /** `null` is "not estimated", which is not the same as 0. */
  storyPoints: number | null;
  /** Backlog rank, lower is higher. Written only through the move endpoint. */
  position: number;
  /** One emoji, and a `#rrggbb` swatch — the same glyph pair a project carries. */
  icon: string | null;
  color: string | null;
  statusId: string;
  status: TaskStatusRef;
  /** `null` is "Empty" — a task need not be prioritised to exist. */
  priority: ProjectPriority | null;
  assigneeId: string | null;
  assignee: TaskPerson | null;
  /** ISO 8601 timestamps; the pickers speak `YYYY-MM-DD` and slice. */
  dueDate: string | null;
  /** Stamped by the server when the task enters a Complete-group status, cleared when it leaves. */
  completedAt: string | null;
  tags: string[];
  attachments: UploadedFile[];
  parentId: string | null;
  parent: TaskRef | null;
  /** The sprint it is planned into; `null` is "in the backlog". */
  sprintId: string | null;
  sprint: { id: string; name: string; state: "PLANNING" | "ACTIVE" | "COMPLETED" } | null;
  subtaskCount: number;
  commentCount: number;
  /** Values for this project's task properties, keyed by definition id. */
  properties: ProjectPropertyValues;
  createdById: string | null;
  createdBy: TaskPerson | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskComment = {
  id: string;
  taskId: string;
  body: string;
  authorId: string | null;
  /** `null` once the author's account is gone — the comment survives them. */
  author: TaskPerson | null;
  /** Set only when the author rewrote the body — drawn as "edited". */
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * One column of a project's TASK database. Per PROJECT, unlike
 * `ProjectPropertyDef` which is per workspace: each project's backlog is its
 * own table.
 */
export type TaskPropertyDef = {
  id: string;
  projectId: string;
  name: string;
  type: PropertyType;
  options: PropertyOption[] | null;
  position: number;
  createdAt: string;
  updatedAt: string;
};

/** Copy for the `code`s the task endpoints return. Never a server string. */
export const TASK_ERROR_COPY: Record<string, string> = {
  VALIDATION_ERROR: "Check the fields and try again.",
  UNAUTHORIZED: "Your session expired. Sign in again.",
  TOKEN_EXPIRED: "Your session expired. Sign in again.",
  FORBIDDEN: "You don't have permission to change that in this project.",
  NOT_FOUND: "That is no longer available. Refresh and try again.",
  CONFLICT: "That name is already used in this project.",
  RATE_LIMITED: "Too many attempts. Try again in a few minutes.",
  SERVER_ERROR: "Something went wrong. Try again.",
};

export function taskErrorCopy(code: string): string {
  return TASK_ERROR_COPY[code] ?? TASK_ERROR_COPY.SERVER_ERROR;
}
