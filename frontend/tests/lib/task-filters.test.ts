import test from "node:test";
import assert from "node:assert/strict";
import {
  NO_FILTERS,
  activeFilterCount,
  byRank,
  matchesFilters,
  tagsIn,
} from "../../src/lib/task-filters.ts";
import { person, task } from "../fixtures.ts";

const withFilters = (over: Partial<typeof NO_FILTERS> = {}) => ({ ...NO_FILTERS, ...over });

test("no filters is zero narrowings and matches everything", () => {
  assert.equal(activeFilterCount(NO_FILTERS), 0);
  assert.equal(matchesFilters(task(), NO_FILTERS), true);
});

test("whitespace-only search does not count as a narrowing", () => {
  assert.equal(activeFilterCount(withFilters({ q: "   " })), 0);
  assert.equal(matchesFilters(task({ title: "Anything" }), withFilters({ q: "   " })), true);
});

test("activeFilterCount counts each set field once", () => {
  assert.equal(
    activeFilterCount(withFilters({ q: "a", type: "BUG", priority: "none", assigneeId: "u1", tag: "ui" })),
    5,
  );
});

test("search matches title and key, case-insensitively, trimmed", () => {
  const row = task({ title: "Fix the login form", key: "TIZ-12" });
  assert.equal(matchesFilters(row, withFilters({ q: "LOGIN" })), true);
  assert.equal(matchesFilters(row, withFilters({ q: "  tiz-12  " })), true);
  assert.equal(matchesFilters(row, withFilters({ q: "tiz-1" })), true);
  assert.equal(matchesFilters(row, withFilters({ q: "logout" })), false);
});

test("type filter is exact", () => {
  assert.equal(matchesFilters(task({ type: "BUG" }), withFilters({ type: "BUG" })), true);
  assert.equal(matchesFilters(task({ type: "BUG" }), withFilters({ type: "STORY" })), false);
});

test("priority 'none' means unprioritised only", () => {
  assert.equal(matchesFilters(task({ priority: null }), withFilters({ priority: "none" })), true);
  assert.equal(matchesFilters(task({ priority: "HIGH" }), withFilters({ priority: "none" })), false);
  assert.equal(matchesFilters(task({ priority: "HIGH" }), withFilters({ priority: "HIGH" })), true);
  assert.equal(matchesFilters(task({ priority: null }), withFilters({ priority: "HIGH" })), false);
});

test("assignee 'none' means unassigned only", () => {
  const mine = task({ assignees: [person("u1"), person("u2")] });
  assert.equal(matchesFilters(task(), withFilters({ assigneeId: "none" })), true);
  assert.equal(matchesFilters(mine, withFilters({ assigneeId: "none" })), false);
  assert.equal(matchesFilters(mine, withFilters({ assigneeId: "u2" })), true);
  assert.equal(matchesFilters(mine, withFilters({ assigneeId: "u9" })), false);
});

test("tag matching is case-insensitive and exact, not a substring", () => {
  const tagged = task({ tags: ["UI", "backend"] });
  assert.equal(matchesFilters(tagged, withFilters({ tag: "ui" })), true);
  assert.equal(matchesFilters(tagged, withFilters({ tag: "BACKEND" })), true);
  assert.equal(matchesFilters(tagged, withFilters({ tag: "back" })), false);
  assert.equal(matchesFilters(task(), withFilters({ tag: "ui" })), false);
});

test("filters compose — all must hold", () => {
  const row = task({ type: "BUG", priority: "HIGH", tags: ["ui"], assignees: [person("u1")] });
  assert.equal(matchesFilters(row, withFilters({ type: "BUG", tag: "ui", assigneeId: "u1" })), true);
  assert.equal(matchesFilters(row, withFilters({ type: "BUG", tag: "api" })), false);
});

test("tagsIn is empty for no tasks and for tagless ones", () => {
  assert.deepEqual(tagsIn([]), []);
  assert.deepEqual(tagsIn([task(), task()]), []);
});

test("tagsIn ranks most-used first, ties alphabetically", () => {
  const tasks = [
    task({ id: "1", tags: ["ui", "api"] }),
    task({ id: "2", tags: ["ui"] }),
    task({ id: "3", tags: ["zeta", "api"] }),
  ];
  assert.deepEqual(tagsIn(tasks), ["api", "ui", "zeta"]);
});

test("tagsIn folds case but keeps the first spelling seen", () => {
  const tasks = [task({ id: "1", tags: ["UI"] }), task({ id: "2", tags: ["ui"] })];
  assert.deepEqual(tagsIn(tasks), ["UI"]);
});

test("byRank sorts on position, breaking ties on number", () => {
  const rows = [
    task({ id: "c", position: 2048, number: 1 }),
    task({ id: "a", position: 1024, number: 9 }),
    task({ id: "b", position: 1024, number: 2 }),
  ];
  assert.deepEqual([...rows].sort(byRank).map((r) => r.id), ["b", "a", "c"]);
});

test("byRank is a stable comparator for identical rows", () => {
  const a = task({ id: "a", position: 1, number: 1 });
  assert.equal(byRank(a, a), 0);
});
