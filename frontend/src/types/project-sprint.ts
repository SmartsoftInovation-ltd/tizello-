/*
 * A sprint exactly as the API returns it — `backend/docs/api/sprint.md`.
 *
 * WHY THIS IS NOT `SprintRecord` FROM `sprint.ts`
 * -----------------------------------------------
 * `SprintRecord` is the fixture shape the sprints LIST screen still renders
 * (`demo-sprints.ts`), keyed by a human `"SPR-13"` id and with `goal` /
 * `capacityPoints` optional. This is the record the planning screen reads and
 * writes: a cuid `id` that every URL takes, `key` for display, and nullable
 * fields that say "not set" as `null`. Same split as `BacklogTask` (fixture)
 * and `Task` (API).
 */

/** Lifecycle order. One way — there is no reopen. */
export const PROJECT_SPRINT_STATES = ["PLANNING", "ACTIVE", "COMPLETED"] as const;
export type ProjectSprintState = (typeof PROJECT_SPRINT_STATES)[number];

export type ProjectSprint = {
  id: string;
  projectId: string;
  /** Per-project sequence, never reused. */
  number: number;
  /** `"SPR-4"`. */
  key: string;
  name: string;
  goal: string | null;
  /** `YYYY-MM-DD`. Optional while planning; both are required to start. */
  startDate: string | null;
  endDate: string | null;
  /** The forecast planning fills against. `null` is "not decided", not zero. */
  capacityPoints: number | null;
  state: ProjectSprintState;
  startedAt: string | null;
  completedAt: string | null;
  createdById: string | null;
  /** Live top-level tasks in the sprint. Sub-tasks ride with their parent. */
  taskCount: number;
  doneCount: number;
  /** Unestimated tasks add nothing. */
  totalPoints: number;
  donePoints: number;
  createdAt: string;
  updatedAt: string;
};

/** What the create and edit dialogs send. `""` dates are sent as `null`. */
export type ProjectSprintInput = {
  name?: string;
  goal?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  capacityPoints?: number | null;
};

/** The Fibonacci ladder the estimate buttons offer — the gaps widen as confidence drops. */
export const STORY_POINT_CHOICES = [1, 2, 3, 5, 8, 13] as const;

export const SPRINT_ERROR_COPY: Record<string, string> = {
  VALIDATION_ERROR: "Check the sprint's details and try again.",
  CONFLICT: "That can't be done to this sprint right now. Refresh and try again.",
  FORBIDDEN: "Only the project's owner or a manager can change sprints.",
  NOT_FOUND: "That sprint is no longer available. Refresh and try again.",
  UNAUTHORIZED: "Your session expired. Sign in again.",
  SERVER_ERROR: "Something went wrong. Try again.",
};

export function sprintErrorCopy(code: string): string {
  return SPRINT_ERROR_COPY[code] ?? SPRINT_ERROR_COPY.SERVER_ERROR;
}
