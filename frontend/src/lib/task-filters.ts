import type { ProjectPriority } from "@/types/project";
import type { Task, TaskType } from "@/types/task";

/*
 * The backlog's search and filters, as pure functions.
 *
 * CLIENT-SIDE, and that is the API's shape rather than a shortcut: a backlog is
 * read whole (`lib/tasks.ts` asks for the 500-row ceiling), so every task the
 * filters could match is already on the page. Filtering locally is instant and
 * costs no request per keystroke. When a project outgrows one page this moves
 * to query params — `backend/docs/api/task.md` §Open questions tracks it.
 *
 * Every filter is ONE value, and `""` is "any". Assignee and priority also have
 * a `"none"`, because "what has nobody picked up" and "what has nobody
 * prioritised" are the two questions a backlog grooming session starts with.
 */

export type TaskFilters = {
  /** Matched against title and key, case-insensitively — people type `TIZ-12`. */
  q: string;
  type: TaskType | "";
  priority: ProjectPriority | "none" | "";
  /** A user id, `"none"` for unassigned, or `""`. */
  assigneeId: string;
  tag: string;
};

export const NO_FILTERS: TaskFilters = { q: "", type: "", priority: "", assigneeId: "", tag: "" };

/** How many narrowings are on, search included — what the Clear control and the pip read. */
export function activeFilterCount(filters: TaskFilters): number {
  return [filters.q.trim(), filters.type, filters.priority, filters.assigneeId, filters.tag].filter(Boolean)
    .length;
}

export function matchesFilters(task: Task, filters: TaskFilters): boolean {
  const needle = filters.q.trim().toLowerCase();

  if (needle && !task.title.toLowerCase().includes(needle) && !task.key.toLowerCase().includes(needle)) {
    return false;
  }
  if (filters.type && task.type !== filters.type) return false;
  if (filters.priority === "none" ? task.priority !== null : filters.priority && task.priority !== filters.priority) {
    return false;
  }
  const assigned = (userId: string) => task.assignees.some((person) => person.id === userId);
  if (filters.assigneeId === "none" ? task.assignees.length > 0 : filters.assigneeId && !assigned(filters.assigneeId)) {
    return false;
  }
  if (filters.tag && !task.tags.some((tag) => tag.toLowerCase() === filters.tag.toLowerCase())) {
    return false;
  }

  return true;
}

/** Every tag used in the project, most-used first — what the Tag filter offers. */
export function tagsIn(tasks: Task[]): string[] {
  const counts = new Map<string, { label: string; count: number }>();

  for (const tag of tasks.flatMap((task) => task.tags)) {
    const key = tag.toLowerCase();
    const entry = counts.get(key);
    counts.set(key, { label: entry?.label ?? tag, count: (entry?.count ?? 0) + 1 });
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .map((entry) => entry.label);
}

/** Rank order, `number` breaking ties — the order the API lists in. */
export function byRank(a: Task, b: Task): number {
  return a.position - b.position || a.number - b.number;
}
