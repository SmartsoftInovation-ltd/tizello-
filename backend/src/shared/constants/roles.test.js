/**
 * Unit tests for the workspace permission ladder.
 *
 * WHY THIS FILE EXISTS. `ROLE_PERMISSIONS` is deliberately written out per role
 * rather than derived by inheritance (see the comment above it), which makes it
 * readable and makes it *droppable*: a line deleted during a refactor silently
 * removes a capability from a role, and nothing else in the codebase would
 * notice. Every endpoint in workspace, member, invitation and project resolves
 * its authorization through `hasPermission`, so the table below is the whole
 * authorization surface of the app expressed as data.
 *
 * The tests pin three separate things:
 *   1. the exact grants per role — the table itself,
 *   2. that the ladder is monotonic (an ADMIN can never do less than a MEMBER),
 *   3. that both helpers FAIL CLOSED on garbage, which is the property that
 *      turns a typo into a 403 instead of into an unguarded endpoint.
 *
 * Pure — no database, no Prisma, no server. Run with `npm test`.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PERMISSIONS,
  ROLES,
  ROLE_ORDER,
  ROLE_PERMISSIONS,
  hasPermission,
  roleAtLeast,
} from './roles.js';

describe('ROLE_PERMISSIONS — the grant table', () => {
  it('gives OWNER every permission that exists', () => {
    // OWNER is the only role that should ever be a superset of PERMISSIONS.
    // If a permission is added and not granted here, the owner of a workspace
    // cannot do it in their own workspace, which is never the intent.
    const all = Object.values(PERMISSIONS).sort();
    assert.deepEqual([...ROLE_PERMISSIONS[ROLES.OWNER]].sort(), all);
  });

  it('withholds exactly the two OWNER-only powers from ADMIN', () => {
    // Deleting the workspace and assigning roles are the rows the header calls
    // out as owner-only. Naming them explicitly means widening ADMIN is a test
    // failure rather than a silent privilege escalation.
    //
    // Billing was the third until `workspace.billing` was removed from the
    // catalog: it had zero enforcement sites, and a grid switch that gates
    // nothing is a control that lies. It returns when billing does.
    const ownerOnly = [
      PERMISSIONS.WORKSPACE_DELETE,
      PERMISSIONS.MEMBER_ROLE_UPDATE,
    ];

    for (const permission of ownerOnly) {
      assert.equal(hasPermission(ROLES.ADMIN, permission), false, permission);
      assert.equal(hasPermission(ROLES.OWNER, permission), true, permission);
    }
  });

  it('gives MEMBER read access plus PROJECT_CREATE, and nothing that writes the workspace', () => {
    // PROJECT_CREATE for a plain MEMBER is the documented deliberate default.
    // It is pinned here so that reversing it is a conscious edit to two files
    // rather than an accident in one.
    assert.deepEqual([...ROLE_PERMISSIONS[ROLES.MEMBER]].sort(), [
      PERMISSIONS.MEMBER_VIEW,
      PERMISSIONS.PROJECT_CREATE,
      PERMISSIONS.PROJECT_VIEW,
      PERMISSIONS.WORKSPACE_VIEW,
    ].sort());
  });

  it('gives PROJECT_MANAGE_ANY to OWNER and ADMIN only — the escape hatch, not a member power', () => {
    // Without it an admin can be locked out of a project in their own
    // workspace by a collaborator who removes them. With it granted to MEMBER,
    // every project in the workspace would be writable by everyone.
    assert.equal(hasPermission(ROLES.OWNER, PERMISSIONS.PROJECT_MANAGE_ANY), true);
    assert.equal(hasPermission(ROLES.ADMIN, PERMISSIONS.PROJECT_MANAGE_ANY), true);
    assert.equal(hasPermission(ROLES.MEMBER, PERMISSIONS.PROJECT_MANAGE_ANY), false);
  });

  it('is monotonic along ROLE_ORDER — a higher role never holds fewer permissions', () => {
    // This is the invariant the explicit table cannot enforce for itself. A
    // line accidentally deleted from OWNER but kept in ADMIN fails here even
    // though every individual assertion above still passes.
    for (let index = 1; index < ROLE_ORDER.length; index += 1) {
      const lower = ROLE_ORDER[index - 1];
      const higher = ROLE_ORDER[index];

      for (const permission of ROLE_PERMISSIONS[lower]) {
        assert.equal(
          hasPermission(higher, permission),
          true,
          `${higher} is missing ${permission}, which ${lower} has`
        );
      }
    }
  });

  it('grants no permission that is not declared in PERMISSIONS', () => {
    // A stale string in the table is a permission nothing checks — dead grant,
    // and a misleading one to read.
    const declared = new Set(Object.values(PERMISSIONS));

    for (const [role, granted] of Object.entries(ROLE_PERMISSIONS)) {
      for (const permission of granted) {
        assert.equal(declared.has(permission), true, `${role} grants undeclared ${permission}`);
      }
    }
  });
});

describe('hasPermission — fails closed', () => {
  it('denies an unknown role rather than throwing', () => {
    // `loadMembership` can hand this a role read straight from a row. A throw
    // here would be a 500 where the correct answer is a 403.
    assert.equal(hasPermission('SUPERUSER', PERMISSIONS.WORKSPACE_VIEW), false);
    assert.equal(hasPermission(undefined, PERMISSIONS.WORKSPACE_VIEW), false);
    assert.equal(hasPermission(null, PERMISSIONS.WORKSPACE_VIEW), false);
    assert.equal(hasPermission('', PERMISSIONS.WORKSPACE_VIEW), false);
  });

  it('denies an unknown permission even for an OWNER', () => {
    // The header's rule: "a permission that is checked but never listed always
    // denies, which is the safe direction". A typo'd constant must lock the
    // endpoint, not open it.
    assert.equal(hasPermission(ROLES.OWNER, 'workspace:nuke'), false);
    assert.equal(hasPermission(ROLES.OWNER, undefined), false);
  });

  it('CURRENT BEHAVIOUR: a prototype key THROWS instead of denying', () => {
    // Pinned, not endorsed — this contradicts the function's own stated
    // contract ("Unknown roles and unknown permissions both return false
    // rather than throwing — an authorization check must fail closed").
    //
    // ROLE_PERMISSIONS is a plain object literal, so `ROLE_PERMISSIONS['toString']`
    // resolves up the prototype chain to a Function. The `if (!granted)` guard
    // sees a truthy value and falls through to `granted.includes(...)`, which
    // is not an array method on a Function — TypeError.
    //
    // It does NOT deny, and it does not fail closed: it produces a generic 500
    // through the global error handler rather than a 403. Not exploitable
    // today — every call site passes `req.membership.role`, which is a Postgres
    // enum — but the guard is not doing the job its comment claims. Reported,
    // not fixed. `Object.hasOwn(ROLE_PERMISSIONS, role)` would close it.
    for (const key of ['toString', 'constructor', '__proto__', 'valueOf']) {
      assert.throws(
        () => hasPermission(key, PERMISSIONS.WORKSPACE_DELETE),
        TypeError,
        `${key} unexpectedly did not throw`
      );
    }
  });

  it('does deny an ordinary unknown string, which is the reachable case', () => {
    assert.equal(hasPermission('MANAGER', PERMISSIONS.WORKSPACE_DELETE), false);
    assert.equal(hasPermission('COLLABORATOR', PERMISSIONS.PROJECT_VIEW), false);
  });
});

describe('roleAtLeast — the ordered ladder', () => {
  it('ranks MEMBER < ADMIN < OWNER', () => {
    assert.equal(roleAtLeast(ROLES.OWNER, ROLES.ADMIN), true);
    assert.equal(roleAtLeast(ROLES.ADMIN, ROLES.MEMBER), true);
    assert.equal(roleAtLeast(ROLES.MEMBER, ROLES.ADMIN), false);
    assert.equal(roleAtLeast(ROLES.ADMIN, ROLES.OWNER), false);
  });

  it('is reflexive — "at least ADMIN" includes an ADMIN', () => {
    // The common call site is `requireAtLeast(ROLES.ADMIN)`, which has to admit
    // an admin. An off-by-one to `>` would lock out the exact role named.
    for (const role of ROLE_ORDER) {
      assert.equal(roleAtLeast(role, role), true, role);
    }
  });

  it('denies when either side is not on the ladder', () => {
    // Project roles (MANAGER, COLLABORATOR) are deliberately NOT in ROLE_ORDER.
    // Passing one here asks a question this function cannot answer, and the
    // answer must be "no" rather than an index-of -1 comparison that happens
    // to be true.
    assert.equal(roleAtLeast('MANAGER', ROLES.MEMBER), false);
    assert.equal(roleAtLeast(ROLES.OWNER, 'COLLABORATOR'), false);
    assert.equal(roleAtLeast(undefined, ROLES.MEMBER), false);
    assert.equal(roleAtLeast(ROLES.MEMBER, undefined), false);
  });
});
