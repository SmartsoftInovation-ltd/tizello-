/**
 * Unit tests for workspace slug generation and its collision retry.
 *
 * WHY THIS IS WORTH PINNING. A slug is in every workspace URL, and it is
 * generated once and never changeable — so the two failure modes are both
 * permanent: an empty slug (a name of pure punctuation or emoji, which is
 * ordinary in this product's audience) and a retry loop that gives up or spins.
 *
 * `withUniqueSlug` takes its insert as a callback precisely so this file can
 * exist without a database, which the header of `slug.js` states as the design
 * intent. These tests are that intent cashed in: the retry is driven by fake
 * inserts that reject with a `P2002`-shaped error, exactly as Prisma would.
 *
 * Pure — no database. Run with `npm test`.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { generateSlug, withUniqueSlug } from './slug.js';

/** A rejection shaped like Prisma's unique-constraint violation. */
const uniqueViolation = () => Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

describe('generateSlug', () => {
  it('lowercases and hyphenates an ordinary name', () => {
    assert.equal(generateSlug('My Workspace'), 'my-workspace');
  });

  it('collapses every run of non-alphanumerics to ONE hyphen', () => {
    // The naive `replace(/[^a-z0-9]/g, '-')` without the `+` produces
    // `hello---world`, which is a different URL for the same name.
    assert.equal(generateSlug('Hello -- World'), 'hello-world');
    assert.equal(generateSlug('A/B   Test!!!'), 'a-b-test');
  });

  it('trims leading and trailing hyphens', () => {
    // Otherwise a name typed with a leading space produces `/-my-workspace`,
    // which looks like a broken route rather than a workspace.
    assert.equal(generateSlug('  Hello--World  '), 'hello-world');
    assert.equal(generateSlug('***Rocket***'), 'rocket');
  });

  it('falls back to "workspace" when the name collapses to nothing', () => {
    // Emoji-only and punctuation-only names are real: an empty slug would make
    // the workspace URL the workspace list's URL.
    assert.equal(generateSlug('🙂'), 'workspace');
    assert.equal(generateSlug('!!!'), 'workspace');
    assert.equal(generateSlug('   '), 'workspace');
    assert.equal(generateSlug(''), 'workspace');
  });

  it('keeps digits, which are legal in a slug', () => {
    assert.equal(generateSlug('Sprint 2026'), 'sprint-2026');
  });

  it('coerces a non-string rather than throwing', () => {
    // `String(name)` is load-bearing: the repository passes whatever the
    // service handed it, and a throw here would be a 500 during workspace
    // creation rather than a validation error earlier.
    assert.equal(generateSlug(42), '42');
    assert.equal(generateSlug(null), 'null');
  });
});

describe('withUniqueSlug', () => {
  it('uses the bare slug when the first insert succeeds', async () => {
    const seen = [];
    const result = await withUniqueSlug('My Workspace', async (slug) => {
      seen.push(slug);
      return { slug };
    });

    assert.deepEqual(seen, ['my-workspace']);
    assert.deepEqual(result, { slug: 'my-workspace' });
  });

  it('suffixes -2, -3, … on each P2002, starting at 2 and never at 1', async () => {
    // `attempt + 1` is the arithmetic being pinned. An off-by-one would make
    // the first retry `-1`, which reads as "the first one" to a human.
    const seen = [];
    await withUniqueSlug('Team', async (slug) => {
      seen.push(slug);
      if (seen.length < 3) throw uniqueViolation();
      return slug;
    });

    assert.deepEqual(seen, ['team', 'team-2', 'team-3']);
  });

  it('rethrows any non-P2002 error immediately, without retrying', async () => {
    // A connection error retried twenty times is twenty times the latency
    // before the same failure reaches the client.
    let calls = 0;
    const boom = Object.assign(new Error('connection reset'), { code: 'P1001' });

    await assert.rejects(
      withUniqueSlug('Team', async () => {
        calls += 1;
        throw boom;
      }),
      /connection reset/
    );
    assert.equal(calls, 1);
  });

  it('gives up after 20 attempts by rethrowing the last P2002', async () => {
    // Not by looping forever, and not by returning undefined: a bounded budget
    // that surfaces the database's own error is what lets the 409 be honest.
    let calls = 0;

    await assert.rejects(
      withUniqueSlug('Team', async () => {
        calls += 1;
        throw uniqueViolation();
      }),
      (error) => error.code === 'P2002'
    );
    assert.equal(calls, 20);
  });

  it('returns whatever the insert returns — it has no opinion on "insert"', async () => {
    // The callback shape is what keeps this function Prisma-free. If it ever
    // started unwrapping a row, it would have an opinion and this would fail.
    const row = { id: 'ws-1', slug: 'team' };
    assert.equal(await withUniqueSlug('Team', async () => row), row);
  });
});
