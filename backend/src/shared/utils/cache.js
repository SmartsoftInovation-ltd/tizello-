/**
 * Versioned read-through cache over Redis.
 *
 * INVALIDATION IS A VERSION BUMP, NEVER A DELETE. Every cached value for a
 * scope (e.g. one workspace's projects) lives under a key that embeds that
 * scope's current version:
 *
 *   cache:v:projects:<workspaceId>                       → 7   (INCR'd on write)
 *   cache:projects:<workspaceId>:v7:<userId>:<queryHash> → JSON
 *
 * A write calls `bumpVersion('projects', workspaceId)`; the next read builds a
 * `v8` key, misses, and refills. The `v7` entries are never read again and
 * expire on their own TTL. The rejected alternative — SCAN + DEL every key
 * matching a pattern — is O(keyspace), not atomic with the write, and a read
 * racing the delete can re-fill a stale entry right after it. A bump is one
 * O(1) INCR, and any read that starts after it can only ever see fresh keys.
 *
 * FAILS OPEN. Redis is an accelerator here, not a source of truth: if it is
 * down, `remember` falls through to the loader and the request succeeds slowly
 * instead of failing. A failed bump is logged at `error` — until the TTL runs
 * out, readers may see the pre-write data, which is why TTLs stay short.
 *
 * Bump AFTER the database write commits, never before: bumping first lets a
 * concurrent reader cache the old row under the new version.
 *
 * See docs/api/project.md §Caching
 */
import { createHash } from 'node:crypto';
import { createLogger } from '../../config/logger.js';

const log = createLogger('cache');

/*
 * Loaded on first use, not at import: `config/redis.js` opens its BullMQ
 * connection the moment it is evaluated, and that open socket keeps any
 * process that merely imports a service — a `node --test` run of
 * trash.service.test.js — alive forever. The module cache makes every call
 * after the first a resolved promise.
 */
const client = async () => (await import('../../config/redis.js')).cache;

const DEFAULT_TTL_SECONDS = 300;

/**
 * Every namespace in one place, so a writer in another module bumps the same
 * string the reader keys on — a typo here is a cache that never invalidates.
 */
const CACHE_NS = Object.freeze({
  PROJECTS: 'projects',
  // The caller's membership + custom role, read by `loadMembership` on every
  // workspace-scoped request. Scope is the workspace; entries are per user.
  MEMBERSHIP: 'membership',
  // A project's sprints — the list and each sprint, roll-ups included. Scope
  // is the PROJECT: roll-ups are computed from tasks, so task and status
  // writes bump it too, not just sprint writes. docs/api/sprint.md §Caching.
  SPRINTS: 'sprints',
});

const versionKey = (namespace, scopeId) => `cache:v:${namespace}:${scopeId}`;

/** The scope's current version; `0` before its first write. */
const getVersion = async (namespace, scopeId) =>
  Number(await (await client()).get(versionKey(namespace, scopeId))) || 0;

/**
 * Invalidates every cached entry for one scope. Never throws: the write it
 * follows has already committed, and failing the request now would report a
 * successful write as an error.
 */
const bumpVersion = async (namespace, scopeId) => {
  try {
    await (await client()).incr(versionKey(namespace, scopeId));
  } catch (err) {
    log.error({ err, namespace, scopeId }, 'Cache version bump failed — entries stale until TTL');
  }
};

/**
 * Wraps a write so it bumps `namespace` for the scope `scopeOf(...args)` once
 * the write has resolved — for services where every exported write touches
 * the same scope and a bump per function body would be ten copies of one line.
 * A write that throws bumps nothing: nothing changed.
 */
const bumpingAfter = (namespace, scopeOf, write) => async (...args) => {
  const result = await write(...args);
  await bumpVersion(namespace, scopeOf(...args));
  return result;
};

/** A short, stable digest of a query object, key order normalised. */
const hashQuery = (query = {}) => {
  const sorted = Object.keys(query)
    .sort()
    .reduce((acc, key) => ({ ...acc, [key]: query[key] }), {});
  return createHash('sha1').update(JSON.stringify(sorted)).digest('hex').slice(0, 16);
};

/**
 * Read-through: returns `{ value, fromCached }`. `parts` are joined after the
 * versioned scope prefix to identify the entry within it (user id, query
 * hash). The loader's result must be JSON-safe — Dates come back as ISO
 * strings, which is exactly what `res.json` would have sent anyway.
 *
 * `null`/`undefined` is NEVER cached. A miss usually means "not found", and
 * caching that would make every write that CREATES the thing (a membership on
 * invite-accept, a new workspace's owner row) need a bump of its own — or a
 * user who just joined keeps getting 404 until the TTL runs out.
 */
const remember = async ({ namespace, scopeId, parts = [], ttl = DEFAULT_TTL_SECONDS }, loader) => {
  let key;
  try {
    const version = await getVersion(namespace, scopeId);
    key = [`cache:${namespace}:${scopeId}:v${version}`, ...parts].join(':');

    const hit = await (await client()).get(key);
    if (hit !== null) return { value: JSON.parse(hit), fromCached: true };
  } catch (err) {
    log.warn({ err, namespace, scopeId }, 'Cache read failed — serving from the database');
    return { value: await loader(), fromCached: false };
  }

  const value = await loader();
  if (value === null || value === undefined) return { value, fromCached: false };

  try {
    await (await client()).set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    log.warn({ err, namespace, scopeId }, 'Cache write failed');
  }

  return { value, fromCached: false };
};

export { CACHE_NS, remember, bumpVersion, bumpingAfter, getVersion, hashQuery };
export default { CACHE_NS, remember, bumpVersion, bumpingAfter, getVersion, hashQuery };
