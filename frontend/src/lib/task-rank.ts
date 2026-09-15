import type { Task } from "@/types/task";

/*
 * Where a dropped task lands in its list, and what to tell the API.
 *
 * Pure, and separate from the drag hook, because this is the part with an
 * off-by-one waiting in it and it is worth reading on its own.
 *
 * THE RULE: dropping ON another row takes that row's place. Coming from ABOVE
 * it in the same list, the task lands just after it; from below or from
 * another status, just before it. That is what the row gap under the pointer
 * shows while dragging, and what `arrayMove` does. Dropping on the section
 * itself (an empty status, a header, the space under the last row) appends.
 *
 * The move names NEIGHBOURS — the server owns the arithmetic
 * (`backend/docs/api/task.md` §Ordering). `optimisticPosition` only exists so
 * the row can move before the response arrives; the server's number replaces
 * it on revalidate.
 */

const STEP = 1024;

export type RankTarget = {
  afterId: string | null;
  beforeId: string | null;
  position: number;
};

export function rankTarget({
  list,
  activeId,
  overId,
  sameList,
}: {
  /** The target status's visible rows, in rank order, the dragged one INCLUDED if it is already there. */
  list: Task[];
  activeId: string;
  /** A task id, or `null` when dropped on the section rather than a row. */
  overId: string | null;
  sameList: boolean;
}): RankTarget | null {
  const others = list.filter((task) => task.id !== activeId);
  let index = others.length;

  if (overId && overId !== activeId) {
    const overIndex = others.findIndex((task) => task.id === overId);
    if (overIndex >= 0) {
      const fromAbove =
        sameList && list.findIndex((task) => task.id === activeId) < list.findIndex((task) => task.id === overId);
      index = fromAbove ? overIndex + 1 : overIndex;
    }
  } else if (overId === activeId) {
    return null;
  }

  const after = others[index - 1] ?? null;
  const before = others[index] ?? null;

  /* Dropped back where it already was. */
  if (sameList) {
    const current = list.findIndex((task) => task.id === activeId);
    if (list[current - 1]?.id === after?.id && list[current + 1]?.id === before?.id) return null;
  }

  const position =
    after && before ? (after.position + before.position) / 2
    : after ? after.position + STEP
    : before ? before.position - STEP
    : 0;

  return { afterId: after?.id ?? null, beforeId: before?.id ?? null, position };
}
