/**
 * Search business rules: work out what the term means, run the three reads in
 * parallel, shape the result. Throws `AppError`; never touches `res`.
 *
 * A CALLER WITH NO MEMBERSHIPS GETS EMPTY LISTS, NOT AN ERROR. Signing up and
 * searching before joining a workspace is an ordinary thing to do, and a 403
 * for it would be telling someone they did something wrong when they did not.
 * It also short-circuits: with no workspace ids there is nothing any query
 * could match, so three round trips are skipped.
 *
 * NOTHING IS CACHED. Results are per-caller by construction — the same term
 * returns different rows for two people in different workspaces — so a shared
 * cache key would either be wrong or would have to carry the membership set,
 * at which point it is a per-user cache with a hit rate near zero for
 * as-you-type queries. docs/api/search.md §Caching.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/search.md
 */

import dto from './search.dto.js';
import repository from './search.repository.js';

/* `TIZ-12`, `spr-4` — a key someone pasted from a commit message or a
   bookmark. Matched as a whole term, never inside a longer string: "TIZ-12" is
   an id, "fix TIZ-12 later" is prose, and treating the second as an id lookup
   would drop the words either side of it. */
const KEY_PATTERN = /^([A-Za-z][A-Za-z0-9]*)-(\d+)$/;

const parseKey = (term) => {
  const found = KEY_PATTERN.exec(term);
  if (!found) return null;

  const number = Number(found[2]);
  /* A number Postgres cannot hold in an `Int` column throws at the driver
     rather than returning nothing, so a pasted `TIZ-99999999999` is treated as
     text instead of as a key. */
  return Number.isSafeInteger(number) && number <= 2_147_483_647 ? { prefix: found[1], number } : null;
};

/**
 * One term, three result lists, scoped to the caller's workspaces.
 *
 * The three reads are issued together rather than in sequence: they are
 * independent, and a palette that types-ahead is measured in how long the
 * slowest one takes, not the sum.
 */
const search = async (user, { q, limit }) => {
  const term = q.trim();
  const workspaceIds = await repository.findWorkspaceIds(user.id);

  if (workspaceIds.length === 0) {
    return { query: term, tasks: [], projects: [], sprints: [] };
  }

  const criteria = { term, key: parseKey(term), limit };

  const [tasks, projects, sprints] = await Promise.all([
    repository.findTasks(workspaceIds, criteria),
    repository.findProjects(workspaceIds, criteria),
    repository.findSprints(workspaceIds, criteria),
  ]);

  return {
    query: term,
    tasks: tasks.map(dto.toTaskHit),
    projects: projects.map(dto.toProjectHit),
    sprints: sprints.map(dto.toSprintHit),
  };
};

export default { search };
