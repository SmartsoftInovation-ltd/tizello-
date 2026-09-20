import test from "node:test";
import assert from "node:assert/strict";
import {
  assignedProgress,
  dueBucket,
  filterByState,
  groupByDue,
  isTomorrow,
  overdueCount,
} from "../../src/lib/my-tasks-groups.ts";
import { assigned } from "../fixtures.ts";

const TODAY = "2026-09-20";

const due = (date: string | null, group: "TODO" | "IN_PROGRESS" | "COMPLETE" = "TODO") =>
  assigned({
    dueDate: date,
    status: { id: group, name: group, color: "gray", group },
  });

test("no due date buckets as someday, whatever the status", () => {
  assert.equal(dueBucket(due(null), TODAY), "someday");
  assert.equal(dueBucket(due(null, "COMPLETE"), TODAY), "someday");
});

test("due today is 'today', not 'overdue'", () => {
  assert.equal(dueBucket(due("2026-09-20"), TODAY), "today");
  assert.equal(dueBucket(due("2026-09-20T23:59:59.000Z"), TODAY), "today");
});

test("yesterday is overdue", () => {
  assert.equal(dueBucket(due("2026-09-19"), TODAY), "overdue");
  assert.equal(dueBucket(due("2026-01-01"), TODAY), "overdue");
});

test("A COMPLETED TASK IS NEVER OVERDUE", () => {
  // Finished a year late still must not wear the alarm.
  assert.equal(dueBucket(due("2025-01-01", "COMPLETE"), TODAY), "soon");
  assert.equal(dueBucket(due("2026-09-19", "COMPLETE"), TODAY), "soon");
  assert.equal(dueBucket(due("2026-09-18", "COMPLETE"), TODAY), "soon");
});

test("an in-progress task overdue is still overdue", () => {
  assert.equal(dueBucket(due("2026-09-19", "IN_PROGRESS"), TODAY), "overdue");
});

test("'soon' is tomorrow through a week out; day eight is the last", () => {
  assert.equal(dueBucket(due("2026-09-21"), TODAY), "soon"); // +1
  assert.equal(dueBucket(due("2026-09-27"), TODAY), "soon"); // +7
  assert.equal(dueBucket(due("2026-09-28"), TODAY), "later"); // +8, boundary
  assert.equal(dueBucket(due("2026-10-01"), TODAY), "later");
});

test("groupByDue keeps DUE_BUCKETS order and drops empty groups", () => {
  const groups = groupByDue(
    [due("2026-10-30"), due(null), due("2026-09-19"), due("2026-09-20")],
    TODAY,
  );
  assert.deepEqual(
    groups.map((group) => group.bucket),
    ["overdue", "today", "later", "someday"],
  );
  assert.equal(groups.every((group) => group.tasks.length > 0), true);
});

test("groupByDue on an empty list is an empty array, not five empty groups", () => {
  assert.deepEqual(groupByDue([], TODAY), []);
});

test("groupByDue preserves the server's order inside a bucket", () => {
  const a = assigned({ id: "a", dueDate: "2026-09-19" });
  const b = assigned({ id: "b", dueDate: "2026-09-18" });
  const groups = groupByDue([a, b], TODAY);
  assert.deepEqual(groups[0].tasks.map((t) => t.id), ["a", "b"]);
});

test("overdueCount ignores completed work", () => {
  const list = [due("2026-09-19"), due("2026-09-18"), due("2026-09-01", "COMPLETE")];
  assert.equal(overdueCount(list, TODAY), 2);
  assert.equal(overdueCount([], TODAY), 0);
});

test("isTomorrow is exact and slices a timestamp", () => {
  assert.equal(isTomorrow("2026-09-21", TODAY), true);
  assert.equal(isTomorrow("2026-09-21T14:00:00.000Z", TODAY), true);
  assert.equal(isTomorrow("2026-09-20", TODAY), false);
  assert.equal(isTomorrow("2026-09-22", TODAY), false);
  assert.equal(isTomorrow("2026-10-01", "2026-09-30"), true);
});

test("assignedProgress returns 0 percent on an empty list, never NaN", () => {
  const progress = assignedProgress([]);
  assert.deepEqual(progress, {
    TODO: 0,
    IN_PROGRESS: 0,
    COMPLETE: 0,
    total: 0,
    percent: 0,
  });
  assert.equal(Number.isNaN(progress.percent), false);
});

test("assignedProgress counts per group and rounds the percent", () => {
  const list = [due("2026-09-20"), due(null, "IN_PROGRESS"), due(null, "COMPLETE")];
  assert.deepEqual(assignedProgress(list), {
    TODO: 1,
    IN_PROGRESS: 1,
    COMPLETE: 1,
    total: 3,
    percent: 33,
  });
});

test("assignedProgress rounds 1 of 6 to 17 and 2 of 3 to 67", () => {
  const six = [...Array(5)].map(() => due(null)).concat([due(null, "COMPLETE")]);
  assert.equal(assignedProgress(six).percent, 17);
  const three = [due(null), due(null, "COMPLETE"), due(null, "COMPLETE")];
  assert.equal(assignedProgress(three).percent, 67);
});

test("assignedProgress reaches exactly 100 when everything is done", () => {
  assert.equal(assignedProgress([due(null, "COMPLETE")]).percent, 100);
});

test("filterByState splits on the COMPLETE group only", () => {
  const list = [due(null), due(null, "IN_PROGRESS"), due(null, "COMPLETE")];
  assert.equal(filterByState(list, "all").length, 3);
  assert.equal(filterByState(list, "done").length, 1);
  assert.equal(filterByState(list, "open").length, 2);
  assert.equal(filterByState(list, "all"), list, "'all' hands back the same array");
  assert.deepEqual(filterByState([], "open"), []);
});
