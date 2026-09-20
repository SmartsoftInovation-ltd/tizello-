import test from "node:test";
import assert from "node:assert/strict";
import {
  BACKLOG,
  SPRINT_WEEKS,
  containerKey,
  containerTasks,
  endDateFor,
  openSprints,
  pointsByGroup,
} from "../../src/lib/sprint-plan.ts";
import { sprint, task } from "../fixtures.ts";

const done = { id: "done", name: "Done", color: "green" as const, group: "COMPLETE" as const };

test("containerKey names the backlog explicitly", () => {
  assert.equal(containerKey(null), `container:${BACKLOG}`);
  assert.equal(containerKey("s1"), "container:s1");
});

test("openSprints drops completed ones only", () => {
  const sprints = [
    sprint({ id: "a", state: "ACTIVE" }),
    sprint({ id: "b", state: "COMPLETED" }),
    sprint({ id: "c", state: "PLANNING" }),
  ];
  assert.deepEqual(openSprints(sprints).map((s) => s.id), ["a", "c"]);
  assert.deepEqual(openSprints([]), []);
});

test("the backlog holds unplanned, unfinished, top-level tasks", () => {
  const tasks = [
    task({ id: "1" }),
    task({ id: "2", status: done }),
    task({ id: "3", sprintId: "s1" }),
  ];
  assert.deepEqual(containerTasks(tasks, null).map((t) => t.id), ["1"]);
});

test("a sprint container holds its tasks whether or not they are finished", () => {
  const tasks = [
    task({ id: "1", sprintId: "s1" }),
    task({ id: "2", sprintId: "s1", status: done }),
    task({ id: "3", sprintId: "s2" }),
  ];
  assert.deepEqual(containerTasks(tasks, "s1").map((t) => t.id), ["1", "2"]);
  assert.deepEqual(containerTasks(tasks, "s3"), []);
});

test("a sub-task rides with its parent and is not drawn as its own row", () => {
  const tasks = [task({ id: "p" }), task({ id: "c", parentId: "p" })];
  assert.deepEqual(containerTasks(tasks, null).map((t) => t.id), ["p"]);
});

test("an ORPHANED sub-task is drawn, because its parent is not on the page", () => {
  const tasks = [task({ id: "c", parentId: "elsewhere" })];
  assert.deepEqual(containerTasks(tasks, null).map((t) => t.id), ["c"]);
});

test("containerTasks keeps the incoming rank order", () => {
  const tasks = [task({ id: "b", position: 2048 }), task({ id: "a", position: 1024 })];
  assert.deepEqual(containerTasks(tasks, null).map((t) => t.id), ["b", "a"]);
});

test("pointsByGroup on no tasks is all zeroes", () => {
  assert.deepEqual(pointsByGroup([]), {
    TODO: 0,
    IN_PROGRESS: 0,
    COMPLETE: 0,
    total: 0,
    unestimated: 0,
  });
});

test("a null estimate adds no points but counts as unestimated", () => {
  const out = pointsByGroup([task({ storyPoints: null }), task({ storyPoints: 3 })]);
  assert.equal(out.total, 3);
  assert.equal(out.TODO, 3);
  assert.equal(out.unestimated, 1);
});

test("zero points is an estimate, not an absence", () => {
  assert.equal(pointsByGroup([task({ storyPoints: 0 })]).unestimated, 0);
});

test("pointsByGroup splits across groups and the total is their sum", () => {
  const out = pointsByGroup([
    task({ id: "1", storyPoints: 3 }),
    task({ id: "2", storyPoints: 5, status: done }),
    task({
      id: "3",
      storyPoints: 2,
      status: { id: "wip", name: "WIP", color: "blue", group: "IN_PROGRESS" },
    }),
  ]);
  assert.deepEqual(out, { TODO: 3, IN_PROGRESS: 2, COMPLETE: 5, total: 10, unestimated: 0 });
  assert.equal(out.TODO + out.IN_PROGRESS + out.COMPLETE, out.total);
});

test("a sprint ends the day before the same weekday comes round", () => {
  // Mon 7 Sep 2026 + 2 weeks ends Sun 20 Sep, not Mon 21.
  assert.equal(endDateFor("2026-09-07", 2), "2026-09-20");
  assert.equal(endDateFor("2026-09-07", 1), "2026-09-13");
  assert.equal(endDateFor("2026-09-07", 4), "2026-10-04");
});

test("every offered sprint length gives an inclusive span of weeks * 7", () => {
  for (const weeks of SPRINT_WEEKS) {
    const end = endDateFor("2026-12-28", weeks);
    assert.equal(
      Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse("2026-12-28T00:00:00Z")) / 86_400_000) + 1,
      weeks * 7,
    );
  }
});
