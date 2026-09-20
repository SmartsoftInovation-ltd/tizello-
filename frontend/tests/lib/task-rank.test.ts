import test from "node:test";
import assert from "node:assert/strict";
import { rankTarget } from "../../src/lib/task-rank.ts";
import { task } from "../fixtures.ts";

const row = (id: string, position: number) => task({ id, position });
const LIST = [row("a", 1024), row("b", 2048), row("c", 3072)];

test("dropping on itself is a no-op", () => {
  assert.equal(
    rankTarget({ list: LIST, activeId: "b", overId: "b", sameList: true }),
    null,
  );
});

test("dropping the middle row on the one above it is a real move, not a no-op", () => {
  // b sits below a, so the drop reads as "from below": b takes a's place.
  assert.deepEqual(rankTarget({ list: LIST, activeId: "b", overId: "a", sameList: true }), {
    afterId: null,
    beforeId: "a",
    position: 1024 - 1024,
  });
});

test("from ABOVE, the task lands just after the row it was dropped on", () => {
  const target = rankTarget({ list: LIST, activeId: "a", overId: "b", sameList: true });
  assert.deepEqual(target, { afterId: "b", beforeId: "c", position: (2048 + 3072) / 2 });
});

test("from BELOW, the task lands just before the row it was dropped on", () => {
  const target = rankTarget({ list: LIST, activeId: "c", overId: "b", sameList: true });
  assert.deepEqual(target, { afterId: "a", beforeId: "b", position: (1024 + 2048) / 2 });
});

test("from ANOTHER list, the task lands before the row, like a drop from below", () => {
  const target = rankTarget({ list: LIST, activeId: "x", overId: "b", sameList: false });
  assert.deepEqual(target, { afterId: "a", beforeId: "b", position: 1536 });
});

test("dropping on the section itself appends", () => {
  const target = rankTarget({ list: LIST, activeId: "x", overId: null, sameList: false });
  assert.deepEqual(target, { afterId: "c", beforeId: null, position: 3072 + 1024 });
});

test("dropping into an EMPTY list gives position 0 and no neighbours", () => {
  const target = rankTarget({ list: [], activeId: "x", overId: null, sameList: false });
  assert.deepEqual(target, { afterId: null, beforeId: null, position: 0 });
});

test("dropping on the first row from another list steps a full STEP back", () => {
  const target = rankTarget({ list: LIST, activeId: "x", overId: "a", sameList: false });
  assert.deepEqual(target, { afterId: null, beforeId: "a", position: 1024 - 1024 });
});

test("an unknown overId falls through to an append", () => {
  const target = rankTarget({ list: LIST, activeId: "x", overId: "ghost", sameList: false });
  assert.deepEqual(target, { afterId: "c", beforeId: null, position: 4096 });
});

test("appending within the same list from the middle is a real move", () => {
  const target = rankTarget({ list: LIST, activeId: "a", overId: null, sameList: true });
  assert.deepEqual(target, { afterId: "c", beforeId: null, position: 4096 });
});

test("appending when already last is a no-op", () => {
  assert.equal(
    rankTarget({ list: LIST, activeId: "c", overId: null, sameList: true }),
    null,
  );
});

test("the midpoint can be fractional — the server owns the real arithmetic", () => {
  const tight = [row("a", 1), row("b", 2), row("c", 3)];
  const target = rankTarget({ list: tight, activeId: "a", overId: "b", sameList: true });
  assert.equal(target?.position, 2.5);
});

test("a single-row list can only be a no-op or an append", () => {
  const one = [row("a", 1024)];
  assert.equal(rankTarget({ list: one, activeId: "a", overId: null, sameList: true }), null);
  assert.deepEqual(rankTarget({ list: one, activeId: "x", overId: "a", sameList: false }), {
    afterId: null,
    beforeId: "a",
    position: 0,
  });
});

test("a move to the very top of another list is expressible", () => {
  const target = rankTarget({ list: LIST, activeId: "x", overId: "a", sameList: false });
  assert.equal(target?.afterId, null);
  assert.equal(target?.beforeId, "a");
});
