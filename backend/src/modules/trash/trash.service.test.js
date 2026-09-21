/**
 * Unit tests for the trash module's permission ladder.
 *
 * WHY THESE TWO FUNCTIONS AND NOT THE ENDPOINTS. `canManageProject` and
 * `canContribute` are the whole security decision of this module, and they are
 * a RE-STATEMENT of rules that live somewhere else — `requireProjectOwner` and
 * `requireProjectContribute` in `shared/middlewares/project.js` and
 * `shared/middlewares/task.js`. A re-statement is exactly the kind of code
 * that drifts: the middleware gains a clause, nobody remembers the copy in the
 * trash service, and restoring quietly becomes easier than deleting was.
 * These tests pin the ladder so that drift fails out loud.
 *
 * They are pure — no database, no Prisma, no server. Run with `npm test`.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ROLES } from '../../shared/constants/roles.js';
import { canContribute, canManageProject } from './trash.service.js';

const OWNER_ID = 'user-owner';
const OTHER_ID = 'user-other';

/** A project owned by `OWNER_ID`, with the caller's ProjectMember rows attached. */
const project = (members = []) => ({ id: 'project-1', ownerId: OWNER_ID, members });

/**
 * A membership on `tier`, holding no workspace-defined role.
 *
 * Both helpers take a MEMBERSHIP rather than a bare tier since custom roles
 * landed: `membershipCan` resolves a role's own grant from `customRole`, and a
 * tier string alone cannot answer for someone holding one. Passing
 * `{ role: tier }` is exactly the shape a membership with `roleId: null` has,
 * which is every membership that predates the feature.
 */
const membership = (tier) => (tier ? { role: tier } : tier);

describe('canManageProject — mirrors requireProjectOwner', () => {
  it('lets a workspace OWNER manage any project in the workspace', () => {
    assert.equal(canManageProject(project(), membership(ROLES.OWNER), OTHER_ID), true);
  });

  it('lets a workspace ADMIN manage any project — the escape hatch', () => {
    // PROJECT_MANAGE_ANY exists so an admin cannot be locked out of a project
    // in their own workspace. See roles.js.
    assert.equal(canManageProject(project(), membership(ROLES.ADMIN), OTHER_ID), true);
  });

  it("lets the project's own owner manage it, whatever their workspace role", () => {
    assert.equal(canManageProject(project(), membership(ROLES.MEMBER), OWNER_ID), true);
  });

  it('refuses a plain workspace MEMBER who does not own the project', () => {
    assert.equal(canManageProject(project(), membership(ROLES.MEMBER), OTHER_ID), false);
  });

  it('refuses a project MANAGER — restoring a project is the owner tier, not the write tier', () => {
    assert.equal(canManageProject(project([{ role: 'MANAGER' }]), membership(ROLES.MEMBER), OTHER_ID), false);
  });

  it('refuses when the role is missing entirely — no membership, no authority', () => {
    // `membershipFor` returns null for a non-member, and `?.role` makes that
    // `undefined`. It must deny rather than throw.
    assert.equal(canManageProject(project(), membership(undefined), OTHER_ID), false);
    assert.equal(canManageProject(project(), membership(null), OTHER_ID), false);
  });
});

describe('canContribute — mirrors requireProjectContribute', () => {
  it('lets anyone with a ProjectMember row restore a task', () => {
    assert.equal(canContribute(project([{ role: 'COLLABORATOR' }]), membership(ROLES.MEMBER), OTHER_ID), true);
  });

  it('lets a project MANAGER restore a task', () => {
    assert.equal(canContribute(project([{ role: 'MANAGER' }]), membership(ROLES.MEMBER), OTHER_ID), true);
  });

  it('inherits everyone canManageProject allows', () => {
    assert.equal(canContribute(project(), membership(ROLES.ADMIN), OTHER_ID), true);
    assert.equal(canContribute(project(), membership(ROLES.MEMBER), OWNER_ID), true);
  });

  it('refuses a workspace MEMBER who is not on the project — read-only stays read-only', () => {
    assert.equal(canContribute(project([]), membership(ROLES.MEMBER), OTHER_ID), false);
  });

  it('treats a missing members array as no membership rather than throwing', () => {
    // `findDeletedTask` always selects `members`, but a caller passing a row
    // shaped some other way must be denied, not crash.
    assert.equal(canContribute({ id: 'p', ownerId: OWNER_ID }, membership(ROLES.MEMBER), OTHER_ID), false);
  });
});

describe('the two ladders stay in the right order', () => {
  it('is never easier to manage a project than to contribute to it', () => {
    // Every (role, membership) combination: contribute must be at least as
    // permissive as manage, or restoring a whole project would be available to
    // someone who cannot restore a single task inside it.
    for (const role of [ROLES.OWNER, ROLES.ADMIN, ROLES.MEMBER, null]) {
      for (const members of [[], [{ role: 'COLLABORATOR' }], [{ role: 'MANAGER' }]]) {
        for (const userId of [OWNER_ID, OTHER_ID]) {
          const row = project(members);
          if (canManageProject(row, role, userId)) {
            assert.equal(canContribute(row, role, userId), true, `manage ⊄ contribute for ${role}/${userId}`);
          }
        }
      }
    }
  });
});
