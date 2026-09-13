import {
  TASK_STATUS_GROUPS,
  type TaskStatusGroup,
  type TaskStatusOption,
} from "@/types/task";

/*
 * The status editor's drag model, as pure functions.
 *
 * ONE FLAT LIST WITH THE GROUP HEADERS IN IT. Moving a status to another group
 * and reordering it inside one are the same gesture, so the editor sorts a
 * single list — `[To-do header, …statuses, In Progress header, …, Complete
 * header, …]` — and a status's group is simply the nearest header above it.
 * The headers themselves cannot be picked up, only dropped around. Three
 * separate sortable containers would need cross-container move logic on every
 * `dragover`; this needs none.
 */

export type OrderEntry =
  | { kind: "group"; id: string; group: TaskStatusGroup }
  | { kind: "status"; id: string; status: TaskStatusOption };

export const groupEntryId = (group: TaskStatusGroup) => `group:${group}`;

export function toEntries(statuses: TaskStatusOption[]): OrderEntry[] {
  return TASK_STATUS_GROUPS.flatMap((group): OrderEntry[] => [
    { kind: "group", id: groupEntryId(group), group },
    ...statuses
      .filter((status) => status.group === group)
      .map((status): OrderEntry => ({ kind: "status", id: status.id, status })),
  ]);
}

/** The `PUT .../order` body: every status once, in order, with the group of the header above it. */
export function fromEntries(entries: OrderEntry[]): { id: string; group: TaskStatusGroup }[] {
  let group: TaskStatusGroup = TASK_STATUS_GROUPS[0];
  const order: { id: string; group: TaskStatusGroup }[] = [];

  for (const entry of entries) {
    if (entry.kind === "group") group = entry.group;
    else order.push({ id: entry.id, group });
  }

  return order;
}

/** What the list looks like once an order lands — drawn at once, before the API answers. */
export function applyOrder(
  statuses: TaskStatusOption[],
  order: { id: string; group: TaskStatusGroup }[],
): TaskStatusOption[] {
  const byId = new Map(statuses.map((status) => [status.id, status]));
  const counts = new Map<TaskStatusGroup, number>();

  return order.flatMap(({ id, group }) => {
    const status = byId.get(id);
    if (!status) return [];

    const index = (counts.get(group) ?? 0) + 1;
    counts.set(group, index);
    return [{ ...status, group, position: index * 10 }];
  });
}

/** Group order, then position — the order the API returns and every list draws. */
export function sortStatuses(statuses: TaskStatusOption[]): TaskStatusOption[] {
  return [...statuses].sort(
    (a, b) =>
      TASK_STATUS_GROUPS.indexOf(a.group) - TASK_STATUS_GROUPS.indexOf(b.group) ||
      a.position - b.position,
  );
}

/** Where a new task starts. */
export function defaultStatusId(statuses: TaskStatusOption[]): string {
  return statuses.find((status) => status.isDefault)?.id ?? statuses[0]?.id ?? "";
}
