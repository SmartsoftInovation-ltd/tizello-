import test from "node:test";
import assert from "node:assert/strict";
import { breakdownLabel, statusBreakdown } from "../../src/lib/status-breakdown.ts";
import { completeCount, groupByPhase, groupByStatus } from "../../src/lib/project-groups.ts";
import { project } from "../fixtures.ts";

test("statusBreakdown on no projects is six zero slices, not NaN", () => {
  const slices = statusBreakdown([]);
  assert.equal(slices.length, 6);
  assert.equal(slices.every((s) => s.percent === 0 && s.startPercent === 0), true);
  assert.equal(slices.every((s) => Number.isFinite(s.percent)), true);
});

test("statusBreakdown counts exactly and rounds each percent on its own", () => {
  // The documented 1/0/1/2/1/1 case: the column sums to 101, deliberately.
  const slices = statusBreakdown([
    project("a", "BACKLOG"),
    project("b", "ACTIVE"),
    project("c", "ON_HOLD"),
    project("d", "ON_HOLD"),
    project("e", "COMPLETED"),
    project("f", "CANCELLED"),
  ]);
  assert.deepEqual(slices.map((s) => s.count), [1, 0, 1, 2, 1, 1]);
  assert.deepEqual(slices.map((s) => s.percent), [17, 0, 17, 33, 17, 17]);
  assert.equal(slices.reduce((sum, s) => sum + s.percent, 0), 101);
});

test("identical counts always show an identical percent", () => {
  const slices = statusBreakdown([
    project("a", "BACKLOG"),
    project("b", "COMPLETED"),
    project("c", "ACTIVE"),
    project("d", "ACTIVE"),
    project("e", "ON_HOLD"),
    project("f", "CANCELLED"),
  ]);
  const backlog = slices.find((s) => s.status === "BACKLOG");
  const completed = slices.find((s) => s.status === "COMPLETED");
  assert.equal(backlog?.percent, completed?.percent);
});

test("arcs are drawn from the UNROUNDED fractions and close the ring", () => {
  const slices = statusBreakdown([project("a", "BACKLOG"), project("b", "ACTIVE"), project("c", "ON_HOLD")]);
  assert.equal(slices[0].startPercent, 0);
  assert.ok(Math.abs(slices[1].startPercent - 100 / 3) < 1e-9);
  const last = slices.at(-1);
  const sweep = (last?.startPercent ?? 0) + (last?.count ?? 0) * (100 / 3);
  assert.ok(Math.abs(sweep - 100) < 1e-9, "the arcs sweep exactly 100, unlike the labels");
});

test("a single project is 100 percent of one slice", () => {
  const slices = statusBreakdown([project("a", "ACTIVE")]);
  assert.equal(slices.find((s) => s.status === "ACTIVE")?.percent, 100);
});

test("breakdownLabel says so when there is nothing yet", () => {
  assert.equal(breakdownLabel(statusBreakdown([]), 0), "Status breakdown: no projects yet.");
});

test("breakdownLabel names only the non-empty slices", () => {
  const projects = [project("a", "ACTIVE"), project("b", "ACTIVE"), project("c", "COMPLETED")];
  const label = breakdownLabel(statusBreakdown(projects), projects.length);
  assert.equal(label, "Status breakdown of 3 projects: Active 2 (67%), Completed 1 (33%).");
  assert.equal(label.includes("Backlog"), false);
});

test("groupByStatus keeps empty groups by default and drops them on request", () => {
  const projects = [project("a", "ACTIVE")];
  assert.equal(groupByStatus(projects).length, 6);
  assert.equal(groupByStatus(projects, { includeEmpty: false }).length, 1);
  assert.equal(groupByStatus([], { includeEmpty: false }).length, 0);
});

test("groupByPhase is total — no project falls off the chart", () => {
  const projects = [
    project("a", "BACKLOG"),
    project("b", "PLANNING"),
    project("c", "ACTIVE"),
    project("d", "ON_HOLD"),
    project("e", "COMPLETED"),
    project("f", "CANCELLED"),
  ];
  const phases = groupByPhase(projects);
  assert.deepEqual(phases.map((p) => p.projects.length), [2, 2, 2]);
  assert.equal(phases.flatMap((p) => p.projects).length, projects.length);
});

test("CANCELLED rides in the COMPLETE lane but is not a completed project", () => {
  const projects = [project("e", "COMPLETED"), project("f", "CANCELLED")];
  assert.equal(groupByPhase(projects)[2].projects.length, 2);
  assert.equal(completeCount(projects), 1);
  assert.equal(completeCount([]), 0);
});
