/**
 * Unit tests for project key derivation and its collision retry.
 *
 * WHY THIS MATTERS MORE THAN THE SLUG. A project key is the prefix of every
 * task id — `TIZ-7` — and those ids get written into commit messages, branch
 * names and bookmarks. The key is immutable after create for exactly that
 * reason, so anything this function gets wrong is permanent and public.
 *
 * The one rule with no second chance is the retry's length behaviour: the
 * suffix eats into the BASE (`ABCDE` → `ABCD2`) rather than extending past the
 * 5-character maximum. An implementation that appended instead would produce
 * `ABCDE2`, which violates the column's own rule — and would only be noticed
 * by the one workspace unlucky enough to collide.
 *
 * Pure — no database, by design (`withUniqueKey` takes the insert as a
 * callback). Run with `npm test`.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { deriveKey, withUniqueKey } from './projectKey.js';

const uniqueViolation = () => Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

describe('deriveKey', () => {
  it('takes initials from a multi-word name', () => {
    assert.equal(deriveKey('Tizello Web App'), 'TWA');
  });

  it('takes the first three characters of a single word', () => {
    // Initials of a one-word name would be a single letter, which is not a
    // readable task prefix and is below MIN_LENGTH anyway.
    assert.equal(deriveKey('Website'), 'WEB');
  });

  it('caps at 5 characters — the column and the validator both stop there', () => {
    assert.equal(deriveKey('Alpha Beta Gamma Delta Epsilon Zeta'), 'ABGDE');
  });

  it('treats punctuation as a word separator, not as a character', () => {
    // "my-cool project" is three words, so MCP — not "MY-" with a hyphen in a
    // key that then fails the validator's `^[A-Z][A-Z0-9]{1,4}$`.
    assert.equal(deriveKey('my-cool project'), 'MCP');
  });

  it('falls back to PROJ when fewer than 2 usable characters survive', () => {
    // A one-character prefix is unreadable on a task, and an emoji-only name
    // leaves nothing at all. Both take the same documented fallback.
    assert.equal(deriveKey('a'), 'PROJ');
    assert.equal(deriveKey('🙂🙂'), 'PROJ');
    assert.equal(deriveKey('!!!'), 'PROJ');
    assert.equal(deriveKey(''), 'PROJ');
  });

  it('accepts a two-character name as-is — 2 is the floor, not an exclusive bound', () => {
    assert.equal(deriveKey('Ab'), 'AB');
  });

  it('keeps digits, which the key pattern allows after the first character', () => {
    assert.equal(deriveKey('Web 2 Rewrite'), 'W2R');
  });

  it('returns a key the project validator would accept, for every name starting with a letter', () => {
    // The derived key never passes through `createProjectSchema` — it is
    // server-generated — so nothing else checks its shape. This is the check.
    const pattern = /^[A-Z][A-Z0-9]{1,4}$/;

    for (const name of ['Tizello Web App', 'Website', 'Ab', 'a', '🙂', 'Web 2 Rewrite', '   ', '']) {
      assert.match(deriveKey(name), pattern, `derived key for ${JSON.stringify(name)}`);
    }
  });

  it('CURRENT BEHAVIOUR: a name starting with a digit derives a key the validator would REJECT', () => {
    // Pinned, not endorsed. `^[A-Z][A-Z0-9]{1,4}$` in project.validator.js
    // requires a leading letter, so a client may not type `9L` — but the
    // server happily derives it from "9 Lives" and stores it, because a
    // derived key skips the validator entirely.
    //
    // The consequence is a project whose key could never be re-entered by
    // hand: any future "rename the key" or import path that validates input
    // would refuse a value this server itself created. Reported, not fixed —
    // this test is here so the next change to `deriveKey` is a decision.
    assert.equal(deriveKey('9 Lives'), '9L');
    assert.equal(deriveKey('2026 Roadmap'), '2R');
    assert.doesNotMatch(deriveKey('9 Lives'), /^[A-Z][A-Z0-9]{1,4}$/);
  });
});

describe('withUniqueKey', () => {
  it('uses the bare base when the first insert succeeds', async () => {
    const seen = [];
    await withUniqueKey('TWA', async (key) => {
      seen.push(key);
      return key;
    });

    assert.deepEqual(seen, ['TWA']);
  });

  it('appends 2, 3, … on each P2002 while the base is short', async () => {
    const seen = [];
    await withUniqueKey('TWA', async (key) => {
      seen.push(key);
      if (seen.length < 3) throw uniqueViolation();
      return key;
    });

    assert.deepEqual(seen, ['TWA', 'TWA2', 'TWA3']);
  });

  it('eats into a 5-character base rather than growing past the limit', async () => {
    // THE rule of this function. `ABCDE` retried is `ABCD2`, never `ABCDE2`.
    const seen = [];
    await withUniqueKey('ABCDE', async (key) => {
      seen.push(key);
      if (seen.length < 3) throw uniqueViolation();
      return key;
    });

    assert.deepEqual(seen, ['ABCDE', 'ABCD2', 'ABCD3']);
  });

  it('never produces a candidate longer than 5 characters, at any attempt', async () => {
    // Attempt 10 onward has a two-digit suffix, which is where a naive
    // implementation silently starts overflowing.
    const seen = [];

    await assert.rejects(
      withUniqueKey('ABCDE', async (key) => {
        seen.push(key);
        throw uniqueViolation();
      })
    );

    assert.equal(seen.length, 20);
    for (const key of seen) assert.ok(key.length <= 5, `${key} is longer than 5`);
    assert.equal(seen[9], 'ABC10');
    assert.equal(seen[19], 'ABC20');
  });

  it('rethrows a non-P2002 error immediately, without retrying', async () => {
    let calls = 0;

    await assert.rejects(
      withUniqueKey('TWA', async () => {
        calls += 1;
        throw Object.assign(new Error('deadlock'), { code: 'P2034' });
      }),
      /deadlock/
    );
    assert.equal(calls, 1);
  });

  it('gives up after 20 attempts by rethrowing the last P2002', async () => {
    let calls = 0;

    await assert.rejects(
      withUniqueKey('TWA', async () => {
        calls += 1;
        throw uniqueViolation();
      }),
      (error) => error.code === 'P2002'
    );
    assert.equal(calls, 20);
  });
});
