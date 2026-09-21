import test from "node:test";
import assert from "node:assert/strict";
import {
  completedCount,
  groupProjectSprints,
  runningSprint,
} from "../../src/lib/project-sprint-groups.ts";
import { sprint } from "../fixtures.ts";

const names = (groups: ReturnType<typeof groupProjectSprints>) =>
  groups.map((group) => [group.state, group.sprints.map((s) => s.id)]);

test("bands come back in display order — running, queued, then the archive", () => {
  const groups = groupProjectSprints([
    sprint({ id: "done", state: "COMPLETED", completedAt: "2026-09-21" }),
    sprint({ id: "next", state: "PLANNING", startDate: "2026-09-22" }),
    sprint({ id: "now", state: "ACTIVE", startDate: "2026-09-15" }),
  ]);

  assert.deepEqual(names(groups), [
    ["ACTIVE", ["now"]],
    ["PLANNING", ["next"]],
    ["COMPLETED", ["done"]],
  ]);
});

test("empty bands are dropped, so a heading never sits over nothing", () => {
  const groups = groupProjectSprints([
    sprint({ id: "done", state: "COMPLETED", completedAt: "2026-09-21" }),
  ]);

  assert.deepEqual(
    groups.map((group) => group.state),
    ["COMPLETED"],
  );
});

test("no sprints is no bands — the caller renders its own empty state", () => {
  assert.deepEqual(groupProjectSprints([]), []);
});

test("completed runs newest first, on when it was CLOSED not when it was due", () => {
  const groups = groupProjectSprints([
    /* Closed early: its endDate is the latest of the three, its completedAt
       the earliest. Sorting on endDate would put it first. */
    sprint({ id: "early", state: "COMPLETED", endDate: "2026-12-31", completedAt: "2026-08-01" }),
    sprint({ id: "latest", state: "COMPLETED", endDate: "2026-09-10", completedAt: "2026-09-21" }),
    sprint({ id: "middle", state: "COMPLETED", endDate: "2026-09-01", completedAt: "2026-09-02" }),
  ]);

  assert.deepEqual(groups[0].sprints.map((s) => s.id), ["latest", "middle", "early"]);
});

test("open bands run oldest first — the order they will happen in", () => {
  const groups = groupProjectSprints([
    sprint({ id: "third", state: "PLANNING", startDate: "2026-10-06" }),
    sprint({ id: "first", state: "PLANNING", startDate: "2026-09-22" }),
    sprint({ id: "second", state: "PLANNING", startDate: "2026-09-29" }),
  ]);

  assert.deepEqual(groups[0].sprints.map((s) => s.id), ["first", "second", "third"]);
});

test("an undated sprint sorts by createdAt rather than taking the page down", () => {
  const groups = groupProjectSprints([
    sprint({ id: "undated", state: "PLANNING", createdAt: "2026-12-01T00:00:00.000Z" }),
    sprint({ id: "dated", state: "PLANNING", startDate: "2026-09-22" }),
  ]);

  assert.deepEqual(groups[0].sprints.map((s) => s.id), ["dated", "undated"]);
});

test("a completed sprint with no completedAt still sorts, on endDate", () => {
  const groups = groupProjectSprints([
    sprint({ id: "older", state: "COMPLETED", endDate: "2026-08-01" }),
    sprint({ id: "newer", state: "COMPLETED", endDate: "2026-09-01" }),
  ]);

  assert.deepEqual(groups[0].sprints.map((s) => s.id), ["newer", "older"]);
});

test("completedCount counts only closed sprints", () => {
  const sprints = [
    sprint({ id: "a", state: "COMPLETED" }),
    sprint({ id: "b", state: "COMPLETED" }),
    sprint({ id: "c", state: "ACTIVE" }),
    sprint({ id: "d", state: "PLANNING" }),
  ];

  assert.equal(completedCount(sprints), 2);
  assert.equal(completedCount([]), 0);
});

test("runningSprint finds the one ACTIVE sprint, or nothing", () => {
  assert.equal(runningSprint([sprint({ id: "a", state: "COMPLETED" })]), undefined);
  assert.equal(
    runningSprint([sprint({ id: "a", state: "COMPLETED" }), sprint({ id: "b", state: "ACTIVE" })])?.id,
    "b",
  );
});
