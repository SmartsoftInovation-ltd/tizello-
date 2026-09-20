import test from "node:test";
import assert from "node:assert/strict";
import { describeDelay, taskDelayDays } from "../../src/lib/task-delay.ts";

const TODAY = "2026-09-20";

test("no due date means no delay at all", () => {
  assert.equal(taskDelayDays({ dueDate: "", completedAt: "", today: TODAY }), null);
});

test("an unfinished task is measured against today", () => {
  assert.equal(taskDelayDays({ dueDate: "2026-09-18", completedAt: "", today: TODAY }), 2);
  assert.equal(taskDelayDays({ dueDate: "2026-09-20", completedAt: "", today: TODAY }), 0);
  assert.equal(taskDelayDays({ dueDate: "2026-09-25", completedAt: "", today: TODAY }), -5);
});

test("a finished task is measured against its completion, not today", () => {
  assert.equal(
    taskDelayDays({ dueDate: "2026-09-18", completedAt: "2026-09-18", today: "2026-12-01" }),
    0,
  );
  assert.equal(
    taskDelayDays({ dueDate: "2026-09-18", completedAt: "2026-09-21", today: "2026-12-01" }),
    3,
  );
  assert.equal(
    taskDelayDays({ dueDate: "2026-09-18", completedAt: "2026-09-10", today: "2026-12-01" }),
    -8,
  );
});

test("full ISO timestamps are sliced to the UTC day", () => {
  // 23:59 UTC on the due day is still on time; a local-time implementation
  // would read this as a day late east of Greenwich.
  assert.equal(
    taskDelayDays({
      dueDate: "2026-09-18T00:00:00.000Z",
      completedAt: "2026-09-18T23:59:59.999Z",
      today: TODAY,
    }),
    0,
  );
});

test("delay spans month and year boundaries", () => {
  assert.equal(taskDelayDays({ dueDate: "2026-12-31", completedAt: "2027-01-01", today: TODAY }), 1);
  assert.equal(taskDelayDays({ dueDate: "2026-01-31", completedAt: "2026-02-01", today: TODAY }), 1);
  assert.equal(taskDelayDays({ dueDate: "2028-02-28", completedAt: "2028-03-01", today: TODAY }), 2);
});

test("an unparseable date yields null rather than NaN", () => {
  assert.equal(taskDelayDays({ dueDate: "not-a-date", completedAt: "", today: TODAY }), null);
  assert.equal(taskDelayDays({ dueDate: "2026-09-18", completedAt: "garbage!!", today: TODAY }), null);
});

test("describeDelay says nothing when there is nothing to say", () => {
  assert.equal(describeDelay(null, false), "");
  assert.equal(describeDelay(null, true), "");
});

test("describeDelay pluralises 'late' correctly", () => {
  assert.equal(describeDelay(1, false), "1 day late");
  assert.equal(describeDelay(2, false), "2 days late");
  assert.equal(describeDelay(14, true), "14 days late");
});

test("a finished task on or before its due date reads 'On time'", () => {
  assert.equal(describeDelay(0, true), "On time");
  assert.equal(describeDelay(-5, true), "On time");
});

test("an unfinished task reads 'Due today' or a countdown", () => {
  assert.equal(describeDelay(0, false), "Due today");
  assert.equal(describeDelay(-1, false), "1 day left");
  assert.equal(describeDelay(-2, false), "2 days left");
  assert.equal(describeDelay(-30, false), "30 days left");
});

test("lateness wins over doneness in the wording", () => {
  assert.equal(describeDelay(3, true), "3 days late");
});
