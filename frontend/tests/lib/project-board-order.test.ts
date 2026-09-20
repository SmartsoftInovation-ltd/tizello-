import test from "node:test";
import assert from "node:assert/strict";
import {
  baseColumns,
  columnProjects,
  place,
  reconcile,
  statusOf,
  type ColumnMap,
} from "../../src/lib/project-board-order.ts";
import { PROJECT_STATUSES } from "../../src/types/project.ts";
import { project } from "../fixtures.ts";

const empty = (): ColumnMap => {
  const map = {} as ColumnMap;
  for (const s of PROJECT_STATUSES) map[s] = [];
  return map;
};

test("baseColumns makes one column per status, empty ones included", () => {
  const columns = baseColumns([]);
  assert.deepEqual(Object.keys(columns).sort(), [...PROJECT_STATUSES].sort());
  assert.equal(Object.values(columns).every((ids) => ids.length === 0), true);
});

test("baseColumns keeps the API's order within a column", () => {
  const columns = baseColumns([project("a", "ACTIVE"), project("b", "BACKLOG"), project("c", "ACTIVE")]);
  assert.deepEqual(columns.ACTIVE, ["a", "c"]);
  assert.deepEqual(columns.BACKLOG, ["b"]);
  assert.deepEqual(columns.ON_HOLD, []);
});

test("reconcile with no stored map hands back the base", () => {
  const base = baseColumns([project("a", "ACTIVE")]);
  assert.equal(reconcile(base, null), base, "same object, not a copy");
});

test("reconcile returns the STORED object when nothing changed", () => {
  // Identity is load-bearing: it is what stops the board re-rendering on every
  // drag frame (see the module's `sameColumns` note).
  const base = baseColumns([project("a", "ACTIVE")]);
  const stored = { ...empty(), ACTIVE: ["a"] };
  assert.equal(reconcile(base, stored), stored);
});

test("a card the user moved stays moved, and is not duplicated", () => {
  const base = baseColumns([project("a", "BACKLOG")]);
  const stored = { ...empty(), ACTIVE: ["a"] };
  const out = reconcile(base, stored);
  assert.deepEqual(out.ACTIVE, ["a"]);
  assert.deepEqual(out.BACKLOG, [], "not in both columns at once");
});

test("a project deleted elsewhere disappears from the stored map", () => {
  const base = baseColumns([project("a", "ACTIVE")]);
  const stored = { ...empty(), ACTIVE: ["a", "gone"] };
  assert.deepEqual(reconcile(base, stored).ACTIVE, ["a"]);
});

test("a project created elsewhere appears at the TOP of its column", () => {
  const base = baseColumns([project("new", "ACTIVE"), project("a", "ACTIVE")]);
  const stored = { ...empty(), ACTIVE: ["a"] };
  assert.deepEqual(reconcile(base, stored).ACTIVE, ["new", "a"]);
});

test("the identity fast-path hands a partial stored map straight back, unfilled", () => {
  // Documented, not asserted as desirable: `sameColumns` reads a missing key
  // as an empty column, so an equal-looking partial map short-circuits and is
  // returned with its holes intact. Unreachable today — `stored` only ever
  // holds output of `baseColumns`/`place` (project-board.tsx:65) — so this
  // pins current behaviour rather than a contract.
  const base = baseColumns([project("a", "ACTIVE")]);
  const partial = { ACTIVE: ["a"] } as unknown as ColumnMap;
  const out = reconcile(base, partial);
  assert.equal(out, partial);
  assert.equal(out.BACKLOG, undefined);
});

test("place moves a card and removes it from every other column first", () => {
  const columns = { ...empty(), BACKLOG: ["a"], ACTIVE: ["a", "b"] };
  const out = place(columns, "a", "ACTIVE", 1);
  assert.deepEqual(out.BACKLOG, []);
  assert.deepEqual(out.ACTIVE, ["b", "a"], "a duplicate cannot survive a place()");
});

test("place clamps a negative index to the top and an over-large one to the end", () => {
  const columns = { ...empty(), ACTIVE: ["a", "b", "c"] };
  assert.deepEqual(place(columns, "c", "ACTIVE", -5).ACTIVE, ["c", "a", "b"]);
  assert.deepEqual(place(columns, "a", "ACTIVE", 99).ACTIVE, ["b", "c", "a"]);
});

test("place into an empty column works at any index", () => {
  assert.deepEqual(place(empty(), "a", "CANCELLED", 3).CANCELLED, ["a"]);
});

test("place does not mutate its input", () => {
  const columns = { ...empty(), ACTIVE: ["a", "b"] };
  place(columns, "a", "BACKLOG", 0);
  assert.deepEqual(columns.ACTIVE, ["a", "b"]);
});

test("statusOf finds the column, or null for an unknown id", () => {
  const columns = { ...empty(), ON_HOLD: ["a"] };
  assert.equal(statusOf(columns, "a"), "ON_HOLD");
  assert.equal(statusOf(columns, "ghost"), null);
  assert.equal(statusOf(empty(), "a"), null);
});

test("columnProjects follows the map's order and drops unknown ids", () => {
  const projects = [project("a", "ACTIVE"), project("b", "ACTIVE")];
  assert.deepEqual(columnProjects(projects, ["b", "a"]).map((p) => p.id), ["b", "a"]);
  assert.deepEqual(columnProjects(projects, ["ghost", "a"]).map((p) => p.id), ["a"]);
  assert.deepEqual(columnProjects([], ["a"]), []);
});
