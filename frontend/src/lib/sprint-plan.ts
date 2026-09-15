import { addDays } from "@/lib/sprint-dates";
import type { ProjectSprint } from "@/types/project-sprint";
import type { Task, TaskStatusGroup } from "@/types/task";

/*
 * The planning screen as pure functions: which container a task is in, the
 * point roll-ups a sprint header shows, and the default dates a sprint starts
 * with.
 *
 * ONE LIST, MANY CONTAINERS. `task.sprintId` decides where a row is drawn, so a
 * task cannot be in two places and a move is a single field — the same
 * "a card is in exactly one place" rule as `.claude/rules/workflow.md`.
 *
 * Roll-ups are computed HERE from the task list rather than read from the
 * sprint's API numbers, because the list is what a drag changes optimistically;
 * a header that waited for the server would lag the row that just moved into it.
 */

/** The id a container's droppable carries. `null` is the backlog. */
export type ContainerId = string | null;

export const BACKLOG = "backlog";

/** Containers are droppables named `container:<sprintId>` or `container:backlog`. */
export function containerKey(sprintId: ContainerId): string {
  return `container:${sprintId ?? BACKLOG}`;
}

/** The sprints planning shows: the running one first, then the queue. History is not plannable. */
export function openSprints(sprints: ProjectSprint[]): ProjectSprint[] {
  return sprints.filter((sprint) => sprint.state !== "COMPLETED");
}

/**
 * The rows a container draws, in rank order: live top-level tasks in that
 * sprint — or, for the backlog, in no sprint and not finished. A finished task
 * with no sprint is done work nobody planned, not something to plan.
 */
export function containerTasks(tasks: Task[], sprintId: ContainerId): Task[] {
  const ids = new Set(tasks.map((task) => task.id));

  return tasks.filter(
    (task) =>
      (!task.parentId || !ids.has(task.parentId)) &&
      (sprintId === null
        ? task.sprintId === null && task.status.group !== "COMPLETE"
        : task.sprintId === sprintId),
  );
}

export type PointsByGroup = Record<TaskStatusGroup, number> & { total: number; unestimated: number };

/** Points per status group — the three pills on a sprint header. */
export function pointsByGroup(tasks: Task[]): PointsByGroup {
  return tasks.reduce<PointsByGroup>(
    (sum, task) => {
      const points = task.storyPoints ?? 0;
      return {
        ...sum,
        [task.status.group]: sum[task.status.group] + points,
        total: sum.total + points,
        unestimated: sum.unestimated + (task.storyPoints === null ? 1 : 0),
      };
    },
    { TODO: 0, IN_PROGRESS: 0, COMPLETE: 0, total: 0, unestimated: 0 },
  );
}

/** The sprint lengths the start dialog offers, in weeks. Two is the common cadence and the default. */
export const SPRINT_WEEKS = [1, 2, 3, 4] as const;

/** A sprint of `weeks` starting on `start` ends the day before the same weekday comes round. */
export function endDateFor(start: string, weeks: number): string {
  return addDays(start, weeks * 7 - 1);
}
