# Search API

**Module:** `src/modules/search/`
**Route prefix:** `/api/v1/search`

> **Sibling-contract check.** Response envelope, `AppError` shape,
> validation-error shape and guard middleware names all match the siblings —
> `ApiResponse.success/error` with `{ success, statusCode, message, data }`
> ([api-response](../../.claude/skills/api-response/SKILL.md)), `AppError`
> thrown from the service and formatted once by the global handler
> ([error-handling](../../.claude/rules/error-handling.md)), Joi via
> `validate(schema, 'query')` exactly as [sprint.md](./sprint.md) does, and
> `authGuard` from `shared/middlewares/auth.js`.
>
> **Deliberate divergences, and why:**
>
> 1. **No resource guard.** Every sibling runs `loadProject` /
>    `requireProjectWrite` or the workspace equivalent. This module runs
>    neither, because there is no single resource to authorise against — see
>    *Scoping* below. The boundary lives in the `where` clause of every query
>    instead, which is stronger than a guard in front of them.
> 2. **No id in the path.** Also a consequence of *Scoping*: the caller never
>    names a workspace, so a caller cannot ask about one they are not in.
> 3. **It has a rate limiter, where `project`, `task` and `sprint` have
>    none.** Those modules' shared gap is recorded in
>    [task.md §Rate limiting](./task.md). This endpoint closes it for itself
>    because it is the cheapest expensive request in the API — see
>    *Rate limiting*.
> 4. **No pagination, and no total count.** A shortlist, not a result set —
>    see *Shape of an answer*.

---

## Scoping model — read this before the endpoint below

**The caller is the scope.** The answer to "search for X" is *everything X
matches that you can already see*, and what the caller can see is derived from
`req.user.id` alone:

```
Membership(userId) → workspaceIds → projects in those workspaces
                                  → tasks in those projects
                                  → sprints in those projects
```

Three properties follow, and all three are load-bearing:

- **A caller cannot express an out-of-scope question.** There is no
  `?workspaceId=`, so there is no request that means "search Acme's
  workspace" for someone outside it. Compare the sibling modules, where the
  id is in the path and a guard's job is to reject it — an endpoint that
  cannot be asked needs no rejection.
- **Out-of-scope rows are never read.** `workspaceId: { in: [...] }` is inside
  every `where` (`search.repository.js`), not a `.filter()` applied to a
  broader read. A future refactor therefore cannot leak by forgetting a filter;
  it would have to delete a clause from the query itself.
- **Visibility is workspace membership, not project membership.** This matches
  `findProjectsForWorkspace`, where `mine` is an opt-in narrowing and the
  default is every project in the workspace. Search inherits that rule rather
  than inventing a stricter one — a task a member could reach in two clicks
  through the board should not be unfindable by name.

**Archived is excluded; deleted is excluded.** `isArchived: false` and
`deletedAt: null` on workspaces and projects, `deletedAt: null` on tasks.
Archiving means "stop showing me this", and a search that resurfaces an
archived project has undone the archive. There is deliberately no
`includeArchived` flag yet: nothing in the client asks for one, and an
unused parameter is an untested code path.

**A caller with no memberships gets three empty lists and a `200`.** Not a
`403`: signing up and searching before joining a workspace is an ordinary
thing to do, and refusing it would be telling someone they did something
wrong when they did not. The service short-circuits before issuing any query.

---

## Matching

Substring, case-insensitive, over a small fixed set of columns — the same
`contains` + `mode: 'insensitive'` matching `project.repository.js` and
`task.repository.js` already apply to their own `q` parameters.

| Type | Columns matched |
|---|---|
| Task | `title`, plus an exact key match (below) |
| Project | `name`, `key` |
| Sprint | `name`, plus an exact key match (below) |

**Task descriptions are not searched.** A description is long prose, so a
two-character term matches most of them, and the hit would be a row the reader
cannot see the reason for — the matched words are not in the result. Adding
descriptions is a full-text change (a `tsvector` column and a GIN index), not a
column added to this `OR`, and it belongs with ranking rather than before it.

**This is matching, not ranking.** Results are ordered `updatedAt desc`, so
ties break toward recent work; there is no relevance score, and a title that
*starts* with the term does not outrank one that merely contains it. Postgres
`ILIKE '%term%'` cannot use a B-tree index, so at real volume this is a
sequential scan — the reason the endpoint is rate-limited today, and the reason
the next change here should be `pg_trgm` + a GIN index rather than more columns.

### Keys are matched as whole terms

A term shaped like `TIZ-12` or `spr-4` is parsed as a key
(`/^([A-Za-z][A-Za-z0-9]*)-(\d+)$/`) and additionally matched as an exact
`(project.key, number)` pair, case-insensitively.

- **Whole term only.** `TIZ-12` is an id; `fix TIZ-12 later` is prose. Treating
  the second as a key lookup would silently drop the words either side of it.
- **The key match is `OR`-ed with the text match, never substituted for it.** A
  project whose name contains "TIZ-12" still comes back.
- **A number outside `Int4` falls back to text.** A pasted `TIZ-99999999999`
  would otherwise reach the driver as an out-of-range integer and throw a `500`
  for what is really a typo.

---

## Rate limiting

| Limiter | Window / max | Key | Why |
|---|---|---|---|
| `searchLimiter` | 60s / 60 | `req.user.id`, falling back to the IP | A substring match across three tables is a scan **per keystroke**. It is the cheapest request for a client to send in a loop and one of the most expensive to serve, which is the pairing that defines a denial-of-service lever. |

**Keyed on the caller, not the address** — the only limiter here that is. Every
other one in `rateLimiter.js` runs before the caller is known, so it keys on
the IP. Search sits behind `authGuard`, so `req.user.id` exists, and it is the
better key: an office, a school or a VPN is one address and many people, and an
IP-keyed budget would lock the twentieth person out because of the nineteenth.

**Order is load-bearing:** `authGuard` → `searchLimiter` → `validate`. Reversed,
`req.user` would be undefined when the key is computed and every caller would
silently share one budget.

**60/minute is generous for a human and tight for a loop.** The client
debounces at 250ms and refuses to ask below two characters, so continuous
typing lands near 4 requests a minute. A caller reaching 60 is not typing.

**Fails closed.** Like every limiter here, a Redis outage answers `429` rather
than letting the request through — see the `failClosed` note in
`rateLimiter.js`. For search specifically this means the feature is unavailable
during a Redis outage rather than unbounded, which is the correct trade for the
one endpoint whose cost is unbounded.

---

## Caching

**Nothing here is cached.** Results are per-caller by construction — the same
term returns different rows for two people in different workspaces — so a
cache key would have to carry the membership set to be correct. At that point
it is a per-user cache, and for as-you-type queries (where almost every term is
a prefix nobody will type again) its hit rate is near zero. A shared key that
omitted the membership set would be a cross-tenant leak, which is the failure
mode worth naming out loud so nobody adds one for the throughput.

---

## Enumeration

The endpoint returns only rows inside the caller's workspaces, so it reveals
nothing about the existence of anything outside them — a project named
"Acme Migration" in a workspace the caller does not belong to is indistinguishable
from no such project.

**Residual oracle, knowingly left open:** timing. A term matching many rows in
a large workspace takes measurably longer than one matching none, so a member
of *some* workspace can in principle infer something about the size of the
data they already have access to. It is bounded by the fact that the signal
only ever describes rows the caller may read, so there is nothing to learn that
a slow scroll would not also reveal.

---

## Auth summary

`authGuard` only. No `requirePermission`, no `loadProject`, no `loadWorkspace` —
every row returned is resolved *from* `req.user.id` rather than checked against
a resource named by the caller (see *Scoping model*).

---

## 1. `GET /api/v1/search`

Search tasks, projects and sprints across every workspace the caller belongs
to. Any authenticated user. Rate limiter: `searchLimiter`.

**Query**

| Field | Rules |
|---|---|
| `q` | Required. Trimmed string, 2–100 characters. |
| `limit` | Optional integer, 1–20, default `5`. |

**`q` has a floor of two characters**, and it is a correctness rule before it is
a cost rule: a one-character `contains` matches most of the database and returns
whichever rows happen to have been updated last, which is noise wearing the
shape of an answer. The client keeps its own copy of the floor so the field
simply stays quiet until a query is worth asking.

**`limit` is per type, not in total.** Five tasks *and* five projects *and* five
sprints. One crowded category can then never starve another out of the palette —
a term matching forty tasks would otherwise return forty tasks and hide the
project with that exact name. The ceiling of 20 is where a reader stops reading
a shortlist and starts scrolling a result set, which is a sign to narrow the
term rather than to raise the cap.

**`200`**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Search results fetched",
  "data": {
    "query": "kanban",
    "tasks": [
      {
        "id": "clx7t2a9b0001qw8k3n2v1x4z",
        "key": "TIZ-12",
        "title": "Notion-style kanban cards",
        "type": "STORY",
        "dueDate": "2026-09-21",
        "status": { "id": "clx7s...", "name": "In Progress", "color": "blue", "group": "IN_PROGRESS" },
        "projectId": "clx7p...",
        "projectName": "Tizello",
        "workspaceId": "clx7w..."
      }
    ],
    "projects": [
      {
        "id": "clx7p...",
        "key": "TIZ",
        "name": "Tizello",
        "status": "ACTIVE",
        "icon": "🎯",
        "color": "#34c77b",
        "workspaceId": "clx7w...",
        "workspaceName": "Atlas Robotics"
      }
    ],
    "sprints": []
  }
}
```

### Shape of an answer

**A hit is not a record.** Each carries a label, a key, where it lives, and the
ids needed to build its URL — nothing more. Returning the full task
(description, properties, assignees, comment counts) would make one keystroke
of a type-ahead heavier than opening the task itself.

**Every hit carries `workspaceId` and `projectId`**, including for rows the
caller has never visited. A search that finds a task in another workspace and
cannot link to it has not found it.

**The three lists are always present**, empty rather than omitted, so a client
never branches on a missing key.

**No `total` and no pagination.** The endpoint answers "the best few things
matching this", and a count would be a second, more expensive query whose
answer changes nothing the reader can act on — narrowing the term is the only
move a palette offers. When ranking lands, "and 43 more" becomes a link to a
results page; it does not belong in the type-ahead contract before then.

**Empty lists are a `200`, never a `404`.** "No results" is a successful answer
to a well-formed question.

**Errors**

| Status | When |
|---|---|
| `400` | `q` missing, shorter than 2 characters, longer than 100, or `limit` outside 1–20. Message names the offending rule — `Type at least 2 characters to search`. |
| `401` | No session. `authGuard`, identical to every other authenticated route. |
| `429` | `searchLimiter` exceeded, **or Redis is unavailable** — the limiter fails closed, so "we cannot count" is answered as "we refuse". Carries `data.code = RATE_LIMITED`, which the frontend already maps to copy. |

There is deliberately **no `403` and no `404` on this endpoint.** Both would
require a resource the caller named, and the caller names none.
