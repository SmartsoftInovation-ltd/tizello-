import test from "node:test";
import assert from "node:assert/strict";
import {
  assigneeLoad,
  ganttRows,
  statusShares,
  statusStep,
  todayPercent,
} from "../../src/lib/sprint-breakdown.ts";
import { person, status, task } from "../fixtures.ts";

const STATUSES = [status("todo", "TODO"), status("doing", "IN_PROGRESS"), status("done", "COMPLETE")];
const at = (id: string, over = {}) => task({ statusId: id, ...over });

test("statusShares keeps empty statuses and never divides by zero", () => {
  const shares = statusShares([], STATUSES);
  assert.equal(shares.length, 3);
  assert.deepEqual(shares.map((s) => s.percent), [0, 0, 0]);
  assert.deepEqual(shares.map((s) => s.startPercent), [0, 0, 0]);
  assert.equal(shares.every((s) => Number.isFinite(s.percent)), true);
});

test("statusShares counts, sums points and walks startPercent", () => {
  const shares = statusShares(
    [at("todo", { storyPoints: 3 }), at("todo", { storyPoints: null }), at("done", { storyPoints: 5 })],
    STATUSES,
  );
  assert.deepEqual(shares.map((s) => s.count), [2, 0, 1]);
  assert.deepEqual(shares.map((s) => s.points), [3, 0, 5]);
  assert.deepEqual(shares.map((s) => s.percent), [67, 0, 33]);
  assert.deepEqual(shares.map((s) => Math.round(s.startPercent)), [0, 67, 67]);
});

test("statusShares rounds independently, so a column may total 101", () => {
  // 1/0/1/2/1/1-style split: three equal thirds each round to 33 -> 99;
  // the documented trade is that identical counts read identically.
  const shares = statusShares([at("todo"), at("doing"), at("done")], STATUSES);
  assert.deepEqual(shares.map((s) => s.percent), [33, 33, 33]);
});

test("statusShares ignores a task whose statusId is not in the list", () => {
  const shares = statusShares([at("ghost"), at("todo")], STATUSES);
  assert.deepEqual(shares.map((s) => s.count), [1, 0, 0]);
  assert.equal(shares[0].percent, 50, "the stray still inflates the denominator");
});

test("assigneeLoad is empty for no tasks", () => {
  assert.deepEqual(assigneeLoad([]), []);
});

test("assigneeLoad gives unassigned work its own row", () => {
  const rows = assigneeLoad([task({ storyPoints: 8 })]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "unassigned");
  assert.equal(rows[0].name, "Unassigned");
  assert.equal(rows[0].total, 8);
  assert.equal(rows[0].taskCount, 1);
});

test("a task with two assignees counts its FULL points for both", () => {
  const rows = assigneeLoad([task({ storyPoints: 5, assignees: [person("a"), person("b")] })]);
  assert.deepEqual(rows.map((r) => r.total), [5, 5]);
  assert.equal(rows[0].total + rows[1].total, 10, "bars deliberately sum above the sprint total");
});

test("assigneeLoad falls back to the email when the name is null", () => {
  const rows = assigneeLoad([task({ assignees: [person("a", null)] })]);
  assert.equal(rows[0].name, "a@example.com");
});

test("assigneeLoad treats a null estimate as zero points but still a task", () => {
  const rows = assigneeLoad([task({ storyPoints: null, assignees: [person("a")] })]);
  assert.equal(rows[0].total, 0);
  assert.equal(rows[0].taskCount, 1);
});

test("assigneeLoad sorts heaviest first, ties by task count, unassigned last", () => {
  const rows = assigneeLoad([
    task({ id: "1", storyPoints: 1, assignees: [person("light")] }),
    task({ id: "2", storyPoints: 9, assignees: [person("heavy")] }),
    task({ id: "3", storyPoints: 20 }),
    task({ id: "4", storyPoints: 1, assignees: [person("tie")] }),
    task({ id: "5", storyPoints: 0, assignees: [person("tie")] }),
  ]);
  assert.deepEqual(rows.map((r) => r.id), ["heavy", "tie", "light", "unassigned"]);
});

test("assigneeLoad splits points across the three status groups", () => {
  const rows = assigneeLoad([
    task({ id: "1", storyPoints: 3, assignees: [person("a")] }),
    task({
      id: "2",
      storyPoints: 5,
      assignees: [person("a")],
      status: { id: "done", name: "Done", color: "green", group: "COMPLETE" },
    }),
  ]);
  assert.deepEqual(rows[0].points, { TODO: 3, IN_PROGRESS: 0, COMPLETE: 5 });
});

test("ganttRows: a due date inside the window bounds the bar", () => {
  const [row] = ganttRows(
    [task({ createdAt: "2026-09-08T00:00:00.000Z", dueDate: "2026-09-09T00:00:00.000Z" })],
    "2026-09-07",
    "2026-09-16",
  );
  assert.equal(row.leftPercent, 10, "day 1 of a 10-day window");
  assert.equal(row.widthPercent, 20, "two inclusive days of ten");
  assert.equal(row.openEnded, false);
});

test("ganttRows: no due date runs to the end and is open-ended", () => {
  const [row] = ganttRows(
    [task({ createdAt: "2026-09-07T00:00:00.000Z" })],
    "2026-09-07",
    "2026-09-16",
  );
  assert.equal(row.leftPercent, 0);
  assert.equal(row.widthPercent, 100);
  assert.equal(row.openEnded, true);
});

test("ganttRows clamps dates outside the window to its edges", () => {
  const [before, after] = ganttRows(
    [
      task({ id: "b", createdAt: "2026-01-01T00:00:00.000Z", dueDate: "2026-01-02T00:00:00.000Z" }),
      task({ id: "a", createdAt: "2026-12-01T00:00:00.000Z" }),
    ],
    "2026-09-07",
    "2026-09-16",
  );
  assert.equal(before.leftPercent, 0);
  assert.equal(before.widthPercent, 10, "clamped to a single day, never negative");
  assert.equal(after.leftPercent, 90);
});

test("ganttRows prefers completedAt over dueDate", () => {
  const [row] = ganttRows(
    [
      task({
        createdAt: "2026-09-07T00:00:00.000Z",
        dueDate: "2026-09-16T00:00:00.000Z",
        completedAt: "2026-09-08T00:00:00.000Z",
      }),
    ],
    "2026-09-07",
    "2026-09-16",
  );
  assert.equal(row.widthPercent, 20);
  assert.equal(row.openEnded, false);
});

test("todayPercent clamps outside the window and is 0 on a zero-length one", () => {
  assert.equal(todayPercent("2026-09-07", "2026-09-16", "2026-09-07"), 0);
  assert.equal(todayPercent("2026-09-07", "2026-09-16", "2026-09-16"), 90);
  assert.equal(todayPercent("2026-09-07", "2026-09-16", "2020-01-01"), 0);
  assert.equal(todayPercent("2026-09-07", "2026-09-16", "2030-01-01"), 90);
  assert.equal(todayPercent("2026-09-07", "2026-09-07", "2026-09-07"), 0);
});

test("statusStep is one-based, and 0 for a status the project no longer has", () => {
  assert.deepEqual(statusStep(STATUSES, "todo"), { step: 1, of: 3 });
  assert.deepEqual(statusStep(STATUSES, "done"), { step: 3, of: 3 });
  assert.deepEqual(statusStep(STATUSES, "ghost"), { step: 0, of: 3 });
  assert.deepEqual(statusStep([], "todo"), { step: 0, of: 0 });
});
