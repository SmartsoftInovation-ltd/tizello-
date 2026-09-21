/**
 * Unit tests for CUSTOM-ROLE resolution — `permissionsFor` and `membershipCan`.
 *
 * WHY A SECOND FILE. `roles.test.js` pins the default grant table, which is a
 * static fact about the product. This pins the rule that decides, at request
 * time, which of two grants applies to a person — and the four places that
 * rule must fail closed. They fail for different reasons and read better apart.
 *
 * These are pure — no database, no Prisma, no server. Run with `npm test`.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import {
  ROLES,
  PERMISSIONS,
  PERMISSION_CATALOG,
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  permissionsFor,
  membershipCan,
} from './roles.js';

/** A membership on `role`, optionally holding a custom role granting `permissions`. */
const membership = (role, permissions) => ({
  role,
  ...(permissions ? { customRole: { id: 'r1', name: 'Custom', permissions } } : {}),
});

describe('permissionsFor — which grant applies', () => {
  it('falls back to the tier when no custom role is held', () => {
    // Every membership that existed before custom roles is in this state, so
    // this is the case that must not have changed at all.
    assert.deepEqual(permissionsFor(membership(ROLES.MEMBER)), ROLE_PERMISSIONS[ROLES.MEMBER]);
    assert.deepEqual(permissionsFor(membership(ROLES.ADMIN)), ROLE_PERMISSIONS[ROLES.ADMIN]);
  });

  it('uses the custom role instead of the tier when one is held', () => {
    const held = permissionsFor(
      membership(ROLES.MEMBER, [PERMISSIONS.WORKSPACE_VIEW, PERMISSIONS.PROJECT_MANAGE_ANY])
    );

    assert.deepEqual(held, [PERMISSIONS.WORKSPACE_VIEW, PERMISSIONS.PROJECT_MANAGE_ANY]);
    // Not the tier's set — the whole point of defining a role.
    assert.equal(held.includes(PERMISSIONS.PROJECT_CREATE), false);
  });

  it('never narrows an OWNER', () => {
    // A custom role on the owner that drops `workspace.delete` would lock the
    // last person with authority out of their own workspace, recoverable only
    // from the database.
    const starved = permissionsFor(membership(ROLES.OWNER, []));

    assert.deepEqual(starved, ALL_PERMISSIONS);
    assert.equal(membershipCan(membership(ROLES.OWNER, []), PERMISSIONS.WORKSPACE_DELETE), true);
  });

  it('drops ids that are not in the catalog', () => {
    // A row written before a permission was retired still holds the dead id,
    // and one the code never had must not be smuggled in by writing it.
    const held = permissionsFor(
      membership(ROLES.MEMBER, [PERMISSIONS.WORKSPACE_VIEW, 'workspace.nuke', '__proto__'])
    );

    assert.deepEqual(held, [PERMISSIONS.WORKSPACE_VIEW]);
  });

  it('returns the ids in catalog order, whatever order they were stored in', () => {
    // The matrix renders straight from this, so a role saved by a client that
    // ticked boxes bottom-up must not draw its row differently.
    const reversed = [...ALL_PERMISSIONS].reverse();

    assert.deepEqual(permissionsFor(membership(ROLES.MEMBER, reversed)), ALL_PERMISSIONS);
  });

  it('denies everything for a missing membership rather than throwing', () => {
    // `loadMembership` 404s a non-member, but `trash.service.js` resolves one
    // per workspace and can legitimately hold null. A throw would be a 500
    // where the right answer is a denial.
    assert.deepEqual(permissionsFor(null), []);
    assert.deepEqual(permissionsFor(undefined), []);
  });

  it('falls back to the tier when the stored grant is not an array', () => {
    // Defensive: a hand-edited row, or a select that forgot `permissions`.
    assert.deepEqual(
      permissionsFor({ role: ROLES.MEMBER, customRole: { permissions: null } }),
      ROLE_PERMISSIONS[ROLES.MEMBER]
    );
  });

  it('denies everything for an unknown tier with no custom role', () => {
    assert.deepEqual(permissionsFor({ role: 'SUPERUSER' }), []);
  });
});

describe('membershipCan — the check every guard makes', () => {
  it('answers from the custom role, not the tier', () => {
    // A plain MEMBER whose role grants the admin escape hatch really holds it.
    const reviewer = membership(ROLES.MEMBER, [PERMISSIONS.PROJECT_MANAGE_ANY]);

    assert.equal(membershipCan(reviewer, PERMISSIONS.PROJECT_MANAGE_ANY), true);
    // And really loses what the tier would have given them.
    assert.equal(membershipCan(reviewer, PERMISSIONS.PROJECT_CREATE), false);
  });

  it('denies an unknown permission even for a role that lists it', () => {
    assert.equal(membershipCan(membership(ROLES.MEMBER, ['workspace.nuke']), 'workspace.nuke'), false);
  });

  it('denies for a missing membership', () => {
    assert.equal(membershipCan(null, PERMISSIONS.WORKSPACE_VIEW), false);
    assert.equal(membershipCan(undefined, PERMISSIONS.WORKSPACE_VIEW), false);
  });
});

describe('PERMISSION_CATALOG — every row is a control that does something', () => {
  /* Walks src/ once, collecting every `PERMISSIONS.X` reference outside this
     constants file and its tests. Reading the source is the only way to ask
     "is this checked anywhere" — an import graph would miss the middlewares
     that take a permission as an argument. */
  const SRC = path.resolve(import.meta.dirname, '..', '..');
  const SKIP = new Set(['node_modules', '.git']);

  const walk = (dir) =>
    readdirSync(dir).flatMap((entry) => {
      if (SKIP.has(entry)) return [];
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) return walk(full);
      return full.endsWith('.js') ? [full] : [];
    });

  const referenced = new Set();
  for (const file of walk(SRC)) {
    if (file.includes('shared/constants/roles')) continue;
    const source = readFileSync(file, 'utf8');
    for (const [name, id] of Object.entries(PERMISSIONS)) {
      if (source.includes(`PERMISSIONS.${name}`)) referenced.add(id);
    }
  }

  it('has no row that nothing enforces', () => {
    // THE INVARIANT THE ROLES SCREEN DEPENDS ON. The catalog is served to the
    // browser and drawn as a grid of switches, so a permission listed here and
    // checked nowhere is a control that claims a power the server never
    // consults. `workspace.billing` was exactly that — declared, granted to
    // OWNER, zero call sites — and `workspace.view` was too until the
    // workspace read started asking for it.
    const dead = ALL_PERMISSIONS.filter((id) => !referenced.has(id));

    assert.deepEqual(dead, [], `catalog rows nothing checks: ${dead.join(', ')}`);
  });

  it('declares every catalog id in PERMISSIONS', () => {
    const declared = new Set(Object.values(PERMISSIONS));

    for (const id of ALL_PERMISSIONS) {
      assert.equal(declared.has(id), true, `${id} is in the catalog but not in PERMISSIONS`);
    }
  });

  it('lists every declared permission in the catalog', () => {
    // The other direction: a permission added to PERMISSIONS and forgotten in
    // PERMISSION_CATALOG is one no role can ever be granted, so every endpoint
    // behind it is unreachable for anyone but an OWNER.
    const inCatalog = new Set(ALL_PERMISSIONS);

    for (const id of Object.values(PERMISSIONS)) {
      assert.equal(inCatalog.has(id), true, `${id} is declared but not in the catalog`);
    }
  });

  it('gives every catalog group a label and at least one action', () => {
    for (const group of PERMISSION_CATALOG) {
      assert.ok(group.area, 'a group with no area');
      assert.ok(group.label, `${group.area} has no label`);
      assert.ok(group.actions.length > 0, `${group.area} has no actions`);
      for (const action of group.actions) {
        assert.ok(action.label, `${action.id} has no label`);
      }
    }
  });
});
