import test from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatDeadline } from "../../src/lib/format-date.ts";
import { initials } from "../../src/lib/initials.ts";
import { plural } from "../../src/lib/plural.ts";
import { deriveProjectKey } from "../../src/lib/project-key.ts";
import {
  DEFAULT_BREAKDOWN_CHART,
  breakdownHref,
  parseBreakdownChart,
} from "../../src/lib/sprint-breakdown-view.ts";

test("plural switches on exactly one", () => {
  assert.equal(plural(1, "project", "projects"), "1 project");
  assert.equal(plural(0, "project", "projects"), "0 projects");
  assert.equal(plural(2, "project", "projects"), "2 projects");
  assert.equal(plural(-1, "project", "projects"), "-1 projects");
});

test("initials take the first letter of the first two words", () => {
  assert.equal(initials("Ada Lovelace"), "AL");
  assert.equal(initials("Ada Byron King Lovelace"), "AB");
  assert.equal(initials("Lantern"), "L", "one word is one letter, deliberately");
  assert.equal(initials("ada lovelace"), "AL");
});

test("initials on empty or whitespace input do not throw", () => {
  assert.equal(initials(""), "");
  assert.equal(initials("  "), "");
});

test("formatDate pins locale and time zone", () => {
  assert.equal(formatDate("2026-08-21T09:12:00.000Z"), "21 Aug 2026");
  assert.equal(formatDate("2026-01-01T00:00:00.000Z"), "1 Jan 2026");
});

test("formatDate does not roll back a late-evening UTC timestamp", () => {
  assert.equal(formatDate("2026-08-21T23:59:59.999Z"), "21 Aug 2026");
  assert.equal(formatDate("2026-08-21T00:00:00.000Z"), "21 Aug 2026");
});

test("formatDeadline carries the weekday and drops the year", () => {
  const out = formatDeadline("2026-09-21T00:00:00.000Z");
  assert.equal(out.startsWith("Mon 21 Sep"), true, out);
  assert.equal(out.includes("2026"), false);
});

test("formatDate is a pure function of the ISO string", () => {
  const iso = "2026-08-21T09:12:00.000Z";
  assert.equal(formatDate(iso), formatDate(iso));
});

test("deriveProjectKey takes three letters of a one-word name", () => {
  assert.equal(deriveProjectKey("Tizello"), "TIZ");
  assert.equal(deriveProjectKey("Go"), "GO");
});

test("deriveProjectKey takes initials of a multi-word name, capped at five", () => {
  assert.equal(deriveProjectKey("Tizello Web App"), "TWA");
  assert.equal(deriveProjectKey("a b c d e f g"), "ABCDE");
});

test("deriveProjectKey folds punctuation and runs of whitespace into separators", () => {
  assert.equal(deriveProjectKey("Tizello-Web_App"), "TWA");
  assert.equal(deriveProjectKey("  Tizello   Web  "), "TW");
});

test("deriveProjectKey keeps digits", () => {
  assert.equal(deriveProjectKey("Phase 2"), "P2");
  assert.equal(deriveProjectKey("2026"), "202");
});

test("an empty name derives to the empty string, not the fallback", () => {
  assert.equal(deriveProjectKey(""), "");
  assert.equal(deriveProjectKey("   "), "");
});

test("a name with no usable characters falls back to PROJ, like the server", () => {
  assert.equal(deriveProjectKey("!!!"), "PROJ");
  assert.equal(deriveProjectKey("🚀"), "PROJ");
});

test("a derived key shorter than two characters falls back to PROJ", () => {
  assert.equal(deriveProjectKey("X"), "PROJ");
  assert.equal(deriveProjectKey("A !"), "PROJ");
});

test("parseBreakdownChart accepts the three charts and falls back otherwise", () => {
  assert.equal(parseBreakdownChart("pie"), "pie");
  assert.equal(parseBreakdownChart("bar"), "bar");
  assert.equal(parseBreakdownChart("gantt"), "gantt");
  assert.equal(parseBreakdownChart("nonsense"), DEFAULT_BREAKDOWN_CHART);
  assert.equal(parseBreakdownChart(undefined), DEFAULT_BREAKDOWN_CHART);
  assert.equal(parseBreakdownChart(["pie"]), DEFAULT_BREAKDOWN_CHART, "a repeated param falls back");
  assert.equal(parseBreakdownChart("Pie"), DEFAULT_BREAKDOWN_CHART, "matching is case-sensitive");
});

test("the default chart is written as an absence, so a view has one URL", () => {
  assert.equal(breakdownHref("pie"), "/board/sprint/breakdown");
  assert.equal(breakdownHref("pie", "p1"), "/board/sprint/breakdown?project=p1");
});

test("a non-default chart is carried, with params in a stable order", () => {
  assert.equal(breakdownHref("gantt"), "/board/sprint/breakdown?chart=gantt");
  assert.equal(breakdownHref("bar", "p1"), "/board/sprint/breakdown?chart=bar&project=p1");
});

test("breakdownHref round-trips through parseBreakdownChart", () => {
  for (const chart of ["pie", "bar", "gantt"] as const) {
    const href = breakdownHref(chart, "p1");
    const value = new URL(href, "https://x").searchParams.get("chart") ?? undefined;
    assert.equal(parseBreakdownChart(value), chart);
  }
});
