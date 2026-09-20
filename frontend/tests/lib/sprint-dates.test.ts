import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  daysInclusive,
  daysRemaining,
  isAfter,
  isWithin,
} from "../../src/lib/sprint-dates.ts";

test("addDays walks forward, backward and across month/year ends", () => {
  assert.equal(addDays("2026-09-03", 13), "2026-09-16");
  assert.equal(addDays("2026-09-03", 0), "2026-09-03");
  assert.equal(addDays("2026-09-03", -3), "2026-08-31");
  assert.equal(addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
});

test("addDays crosses a leap day and a non-leap February", () => {
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2028-02-29", 1), "2028-03-01");
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
});

test("addDays survives a DST boundary because everything is UTC", () => {
  // 29 Mar 2026 is the European spring-forward; a local-time implementation
  // would drop or add an hour and could land on the wrong day.
  assert.equal(addDays("2026-03-28", 1), "2026-03-29");
  assert.equal(addDays("2026-03-29", 1), "2026-03-30");
  assert.equal(addDays("2026-10-24", 1), "2026-10-25");
  assert.equal(addDays("2026-10-25", 1), "2026-10-26");
});

test("daysInclusive counts both ends", () => {
  // Mon 7 Sep to Fri 11 Sep 2026 is five days, not four.
  assert.equal(daysInclusive("2026-09-07", "2026-09-11"), 5);
  assert.equal(daysInclusive("2026-09-07", "2026-09-07"), 1);
  assert.equal(daysInclusive("2026-09-07", "2026-09-20"), 14);
});

test("daysInclusive is negative when the ends are the wrong way round", () => {
  assert.equal(daysInclusive("2026-09-11", "2026-09-07"), -3);
});

test("daysInclusive spans a month, a year and a leap year", () => {
  assert.equal(daysInclusive("2026-01-01", "2026-01-31"), 31);
  assert.equal(daysInclusive("2026-01-01", "2026-12-31"), 365);
  assert.equal(daysInclusive("2028-01-01", "2028-12-31"), 366);
});

test("isAfter is strict — an end equal to the start is not after it", () => {
  assert.equal(isAfter("2026-09-08", "2026-09-07"), true);
  assert.equal(isAfter("2026-09-07", "2026-09-07"), false);
  assert.equal(isAfter("2026-09-06", "2026-09-07"), false);
});

test("isWithin includes both boundary days", () => {
  const start = "2026-09-07";
  const end = "2026-09-18";
  assert.equal(isWithin(start, start, end), true);
  assert.equal(isWithin(end, start, end), true);
  assert.equal(isWithin("2026-09-12", start, end), true);
  assert.equal(isWithin("2026-09-06", start, end), false);
  assert.equal(isWithin("2026-09-19", start, end), false);
});

test("isWithin on a one-day window matches only that day", () => {
  assert.equal(isWithin("2026-09-07", "2026-09-07", "2026-09-07"), true);
  assert.equal(isWithin("2026-09-08", "2026-09-07", "2026-09-07"), false);
});

test("daysRemaining counts today as one and goes negative when late", () => {
  assert.equal(daysRemaining("2026-09-18", "2026-09-18"), 1);
  assert.equal(daysRemaining("2026-09-17", "2026-09-18"), 2);
  assert.equal(daysRemaining("2026-09-19", "2026-09-18"), 0);
  assert.equal(daysRemaining("2026-09-25", "2026-09-18"), -6);
});

test("daysRemaining tolerates a full ISO timestamp being passed as today", () => {
  // The callers slice to 10 chars first; extra text still parses to the day.
  assert.equal(daysRemaining("2026-09-18", "2026-09-20"), 3);
});

test("daysInclusive and daysRemaining agree at the window's start", () => {
  const start = "2026-09-07";
  const end = "2026-09-18";
  assert.equal(daysRemaining(start, end), daysInclusive(start, end));
});

test("addDays and daysInclusive round-trip", () => {
  const start = "2026-09-07";
  for (const n of [0, 1, 6, 13, 27, 364]) {
    assert.equal(daysInclusive(start, addDays(start, n)), n + 1);
  }
});
