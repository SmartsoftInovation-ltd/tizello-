import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { sliceWidths, timeLeft, type StatusSlice } from "@/lib/sprint-progress";

const slice = (points: number, count = 1): StatusSlice => ({
  id: `s${points}-${count}`,
  name: "x",
  color: "gray",
  group: "IN_PROGRESS",
  points,
  count,
});

describe("sliceWidths", () => {
  it("splits the bar by points", () => {
    assert.deepEqual(sliceWidths([slice(3), slice(1)]), [75, 25]);
  });

  it("falls back to card count when nothing is estimated", () => {
    assert.deepEqual(sliceWidths([slice(0, 1), slice(0, 3)]), [25, 75]);
  });
});

describe("timeLeft", () => {
  it("is full and green on day one", () => {
    assert.deepEqual(timeLeft(10, 10), { percent: 100, tone: "plenty" });
  });

  it("turns yellow at half left, orange at a quarter", () => {
    assert.equal(timeLeft(10, 5).tone, "half");
    assert.equal(timeLeft(10, 2).tone, "low");
  });

  it("is red on the last day and when overdue — overdue fills the bar", () => {
    assert.deepEqual(timeLeft(10, 1), { percent: 10, tone: "critical" });
    assert.deepEqual(timeLeft(10, -2), { percent: 100, tone: "critical" });
  });
});
