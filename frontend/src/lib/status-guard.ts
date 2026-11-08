import type { TaskStatusGroup } from "@/types/task";

/*
 * A project must always keep at least one status in the COMPLETE group.
 *
 * Completion and every points roll-up read a status's GROUP, never its name
 * (`.claude/rules/workflow.md`). Drag the only Complete column in among the
 * In Progress ones and it silently joins that group — after which a card in
 * "Done" is in progress, and the sprint can never read more than 0% done.
 * That is how this guard came to exist.
 *
 * A mirror of the API's check in `task-status.service.js`, so the editor and
 * the board can refuse with a sentence before sending anything; the API
 * refuses regardless.
 */
export const LAST_COMPLETE_MESSAGE =
  "Keep at least one status in Complete — finished work needs a column to land in. Add another Complete status first.";

type Grouped = { group: TaskStatusGroup };

const hasComplete = (statuses: readonly Grouped[]) =>
  statuses.some((status) => status.group === "COMPLETE");

/** Would going from `before` to `after` remove the project's last Complete status? */
export function losesLastComplete(before: readonly Grouped[], after: readonly Grouped[]): boolean {
  return hasComplete(before) && !hasComplete(after);
}
