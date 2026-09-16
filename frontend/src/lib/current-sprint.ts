import type { ProjectSprint } from "@/types/project-sprint";
import type { Task, TaskStatusOption } from "@/types/task";
import { sortStatuses } from "@/lib/task-status-order";

/*
 * The current sprint board as pure functions: which sprint it shows, which
 * tasks, and which columns.
 *
 * COLUMNS ARE THE PROJECT'S STATUSES, not a fixed To do / In progress / Done.
 * A team that adds "Review" or "QA" gets that column the moment the status
 * exists, in the order the status editor keeps (group, then position). Each
 * status still belongs to one of the three groups, which is what keeps
 * `completedAt` and the point roll-ups meaningful however many columns there
 * are — `backend/docs/api/task.md` §Statuses.
 */

/** Columns are droppables named `column:<statusId>`, so a drop on one can be told from a drop on a card. */
export function columnKey(statusId: string): string {
  return `column:${statusId}`;
}

/** One project runs at most one sprint at a time — the API enforces it. */
export function activeSprint(sprints: ProjectSprint[]): ProjectSprint | null {
  return sprints.find((sprint) => sprint.state === "ACTIVE") ?? null;
}

/** The board's cards: live top-level tasks planned into the sprint, in rank order. Sub-tasks ride inside their parent. */
export function sprintTasks(tasks: Task[], sprintId: string): Task[] {
  const ids = new Set(tasks.map((task) => task.id));
  return tasks.filter((task) => task.sprintId === sprintId && (!task.parentId || !ids.has(task.parentId)));
}

export function boardColumns(statuses: TaskStatusOption[]): TaskStatusOption[] {
  return sortStatuses(statuses);
}

/** A column's cards, in rank order. */
export function columnTasks(tasks: Task[], statusId: string): Task[] {
  return tasks.filter((task) => task.statusId === statusId);
}
