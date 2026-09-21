import test from "node:test";
import assert from "node:assert/strict";
import {
  PLANNING_CHILDREN,
  SIDEBAR_PLANNING_CHILDREN,
  currentChildId,
} from "../../src/lib/nav-links.ts";

test("the tab strip keeps Breakdown; the sidebar drops it", () => {
  const tabs = PLANNING_CHILDREN.map((child) => child.id);
  const rows = SIDEBAR_PLANNING_CHILDREN.map((child) => child.id);

  assert.ok(tabs.includes("sprint-breakdown"));
  assert.ok(!rows.includes("sprint-breakdown"));
});

test("the sidebar list is the tab list minus tab-only children, in order", () => {
  assert.deepEqual(
    SIDEBAR_PLANNING_CHILDREN.map((child) => child.id),
    PLANNING_CHILDREN.filter((child) => !child.tabOnly).map((child) => child.id),
  );
});

test("both lists point at the same href for every shared id", () => {
  for (const row of SIDEBAR_PLANNING_CHILDREN) {
    const tab = PLANNING_CHILDREN.find((child) => child.id === row.id);
    assert.equal(tab?.href, row.href, `${row.id} disagrees between the two strips`);
  }
});

test("an exact pathname match wins", () => {
  assert.equal(currentChildId(SIDEBAR_PLANNING_CHILDREN, "/board/sprint"), "current-sprint");
  assert.equal(currentChildId(SIDEBAR_PLANNING_CHILDREN, "/board/backlog"), "backlog");
  assert.equal(currentChildId(SIDEBAR_PLANNING_CHILDREN, "/board/sprints"), "sprints");
});

test("the breakdown's route lights the screen it is a lens on", () => {
  assert.equal(
    currentChildId(SIDEBAR_PLANNING_CHILDREN, "/board/sprint/breakdown"),
    "current-sprint",
  );
});

test("/board/sprints is not read as sitting under /board/sprint", () => {
  /* The near-miss a bare startsWith would produce: the archive lighting the
     board's row. The trailing slash in the prefix test is what stops it. */
  assert.notEqual(currentChildId(SIDEBAR_PLANNING_CHILDREN, "/board/sprints"), "current-sprint");
});

test("an unrelated pathname matches nothing", () => {
  assert.equal(currentChildId(SIDEBAR_PLANNING_CHILDREN, "/my-tasks"), undefined);
  assert.equal(currentChildId(SIDEBAR_PLANNING_CHILDREN, "/workspaces"), undefined);
});

test("the deepest matching child wins over a shallower one", () => {
  const children = [
    { id: "shallow", label: "Shallow", href: "/a" },
    { id: "deep", label: "Deep", href: "/a/b" },
  ];

  assert.equal(currentChildId(children, "/a/b/c"), "deep");
  assert.equal(currentChildId(children, "/a/x"), "shallow");
});
