import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { pageTrail } from "@/lib/page-trail";

const ID = "cmtr4i04q0003rcj27ut25z6s";
const labels = (path: string) => pageTrail(path).map((crumb) => crumb.label);

describe("pageTrail", () => {
  it("drops /workspaces itself — Home already points there", () => {
    assert.deepEqual(labels("/workspaces"), []);
  });

  it("names the permissions page and skips the settings and id segments", () => {
    assert.deepEqual(labels(`/workspaces/${ID}/settings/permissions`), ["Roles & permissions"]);
  });

  it("names the role editor pages from their collection", () => {
    assert.deepEqual(labels(`/workspaces/${ID}/settings/permissions/roles/new`), ["Roles & permissions", "New role"]);
    assert.deepEqual(labels(`/workspaces/${ID}/settings/permissions/roles/${ID}`), ["Roles & permissions", "Edit role"]);
  });

  it("links each crumb to its own path", () => {
    const [permissions] = pageTrail(`/workspaces/${ID}/settings/permissions/roles/new`);
    assert.equal(permissions.href, `/workspaces/${ID}/settings/permissions`);
  });

  it("keeps project ancestors that have pages", () => {
    assert.deepEqual(labels(`/workspaces/${ID}/projects/${ID}/backlog`), ["Projects", "Backlog"]);
  });

  it("names a page that ends on an id from its collection", () => {
    assert.deepEqual(labels(`/workspaces/${ID}`), ["Overview"]);
  });
});
