# `workspace` — API contract

**Module:** `src/modules/workspace/` · **Route prefix:** `/api/v1/workspaces`

> **Sibling-contract check.** Response envelope, `AppError` shape,
> validation-error shape, guard middleware names and rate-limiter precedent all
> match [auth.md](./auth.md) and [invitation.md](./invitation.md):
> `{ success, statusCode, message, data }` from `ApiResponse`, services
> throwing `AppError` with a `data.code`, `validate` producing `400` with a
> per-field `details` array, and `authGuard` / `loadMembership` /
> `requirePermission` from `shared/middlewares/`.
>
> **Deliberate divergences, three of them:**
>
> 1. **Far less enumeration defence than `auth`.** Auth hides *whether an
>    account exists* because an address is a durable, reusable identifier
>    tied to a real person outside the app. A workspace slug is neither: it is
>    chosen by a member, visible to every member, and knowing it proves
>    nothing about who is in it. The one place this module *does* hide
>    existence is the standard "non-member vs nonexistent" case (§*Guards*),
>    which is `loadMembership`'s existing behavior, not something new here.
> 2. **Billing fields exist on the row and appear nowhere in this contract.**
>    `plan`, `planExpiresAt`, `seatLimit`, `lastPaymentAt` are schema-only
>    today — added ahead of time so the SSLCommerz integration doesn't need a
>    later migration, but no endpoint below reads or writes them, and the DTO
>    does not return them. Treat any of the four appearing in a future PR
>    without an accompanying billing contract as a scope leak.
> 3. **Create has no workspace scope, by construction.** Every other endpoint
>    sits behind `loadMembership`, which resolves a role from
>    `(userId, workspaceId)`. `POST /workspaces` cannot — the workspace does
>    not exist yet — so it is `authGuard` only, and the service itself inserts
>    the caller's `OWNER` membership in the same transaction as the row.

---

## Workspace model — read this before any endpoint below

### Identity and slug

`slug` is the human-facing identifier (URL segments, later features) and is
**never accepted from the client** — it is derived from `name` at create
time and is immutable after that. See §*Slug generation* below for exactly
how.

### Two ways a workspace stops appearing, and they are not the same operation

| Column | Reversible | Meaning |
|---|---|---|
| `isArchived` | yes | Hidden from the default list; a member can still open it directly and can un-archive it. |
| `deletedAt` | no | Soft-deleted. Excluded from every query this module runs, with no endpoint to undo it. |

A row can be archived and later deleted, but never the other order in a way
that matters — `deletedAt` being set makes `isArchived` moot, since the row
is gone from every read path regardless. Folding these into one status enum
was considered and rejected: "archived" and "deleted" are independent facts
a reader should be able to see recorded separately, the same reasoning
`invitation.md` gives for four timestamps over one status column.

### Membership, not a new model

Workspace ↔ User is the existing `Membership` model (`prisma/schema.prisma`),
already read by `shared/middlewares/permission.js`. This module does not
define its own membership table — **ownership is "the `Membership` row with
`role: OWNER`", not a column on `Workspace`.** A workspace with no `OWNER`
membership is an invariant violation, never a valid state; `createWorkspace`
is the only place that can create one, and it does so in the same transaction
as the workspace row.

### Slug generation

1. Lowercase `name`, replace runs of anything outside `[a-z0-9]` with a single
   `-`, trim leading/trailing `-`. Empty result (a name that is all
   punctuation/emoji) falls back to `workspace`.
2. Try the bare slug first. On a unique-constraint hit, append `-2`, `-3`, …
   and retry — checked by catching Postgres `P2002` on the insert, not by a
   separate `SELECT` first, so a race between two requests choosing the same
   base slug cannot both "pass" a pre-check and then collide anyway.
3. Bounded at 20 attempts; exhausting it throws `500` rather than looping —
   in practice unreachable outside a test that deliberately pre-seeds
   `name-2` .. `name-21`.

---

## Rate limiting

| Limiter | Window / max | Endpoints | Why |
|---|---|---|---|
| `workspaceCreateLimiter` | 1h / 10 | create | Spam/farming prevention. Ten is generous for a real user and cheap for an abuser to hit, which is the point — this is a coarse guard, not a plan enforcement mechanism (there is no seat/workspace cap yet). |
| `apiLimiter` *(existing, shared)* | 15m / 100 | list, get, update, archive, delete | General-purpose budget already applied API-wide; nothing here is sensitive enough to need its own tighter window. |

Both fail closed on a Redis outage, per the existing `failClosed` wrapper —
see [auth.md](./auth.md) §*Rate limiting* for why fail-open is never
acceptable on this codebase's limiters.

---

## Guards

Every endpoint requires `authGuard`. Beyond that:

| Endpoint | Additional guard | Why |
|---|---|---|
| Create | none | No workspace exists yet to scope a membership lookup to (§*divergence 3*). |
| List | none | Scoped to the caller's own memberships inside the service — there is no `:workspaceId` to check. |
| Get / Update / Archive / Delete | `loadMembership` | Resolves `req.membership` from `(req.user.id, req.params.workspaceId)`. **A non-member gets `404`, not `403`** — confirming a workspace exists to someone with no access to it is the same leak `auth.md` and `invitation.md` both refuse. This is `loadMembership`'s existing behavior, unchanged here. |
| Update, Archive | `requirePermission(WORKSPACE_UPDATE)` | OWNER and ADMIN hold it (`shared/constants/roles.js`); MEMBER does not. |
| Delete | `requirePermission(WORKSPACE_DELETE)` | OWNER only. Irreversible, so the narrowest role gets it — deliberately tighter than update/archive. |

`requireRole` (identity rather than capability) is not used anywhere in this
module — every check here is "can this role do X", which is exactly what
`requirePermission` is for.

---

## 1. `POST /api/v1/workspaces`

Creates a workspace and makes the caller its `OWNER`. Any authenticated user.
`workspaceCreateLimiter` (1h / 10).

| Field | Rules |
|---|---|
| `name` | string, 2–80, trimmed, required |
| `description` | string, ≤500, optional |
| `icon` | string, ≤8 chars (room for a multi-codepoint emoji), optional |
| `color` | string, `/^#[0-9a-fA-F]{6}$/`, optional |

`slug` is never a request field — see §*Slug generation*. `settings` is not
settable at create; it starts `null` and is only ever written through
`PATCH .../:workspaceId`.

**`201`**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Workspace created",
  "data": {
    "workspace": {
      "id": "cmtqxyz001",
      "name": "Product Team",
      "slug": "product-team",
      "description": null,
      "icon": "🚀",
      "color": "#6366f1",
      "isArchived": false,
      "role": "OWNER",
      "createdAt": "2026-09-07T06:00:00.000Z",
      "updatedAt": "2026-09-07T06:00:00.000Z"
    }
  }
}
```

`role` in the response is the *caller's* role in this workspace, not a
workspace-level field — every endpoint below includes it for the same
reason a UI needs to know "can I see an edit button" without a second call.

**Errors**

| Status | When |
|---|---|
| `400` | Validation failed. |
| `429` | `RATE_LIMITED`. |
| `500` | Slug generation exhausted 20 attempts — see §*Slug generation* step 3. |

---

## 2. `GET /api/v1/workspaces`

Lists workspaces the caller is a member of. Any authenticated user.
`apiLimiter`.

| Query | Rules |
|---|---|
| `page` | integer ≥1, default `1` |
| `limit` | integer 1–100, default `20` |
| `includeArchived` | `"true"` / `"false"`, default `false` |

Scoped by joining through `Membership` on `req.user.id` — there is no way to
list another user's workspaces, so unlike `Get/Update/Archive/Delete` there is
no membership row to check per-item; the join itself *is* the scope.
`deletedAt` rows are excluded unconditionally, regardless of
`includeArchived`.

**`200`**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Workspaces fetched",
  "data": [
    {
      "id": "cmtqxyz001",
      "name": "Product Team",
      "slug": "product-team",
      "description": null,
      "icon": "🚀",
      "color": "#6366f1",
      "isArchived": false,
      "role": "OWNER",
      "createdAt": "2026-09-07T06:00:00.000Z",
      "updatedAt": "2026-09-07T06:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

**Errors**

| Status | When |
|---|---|
| `400` | Invalid `page` / `limit` / `includeArchived`. |

---

## 2a. `GET /api/v1/workspaces/overview`

The numbers behind the dashboard on the frontend's `/workspaces` page: one row
per live, unarchived workspace the caller belongs to, plus totals across them.
`authGuard` only — like §2, its scope is the caller's own memberships, joined
into every query, so there is no `:workspaceId` and no workspace guard.
Registered before `/:workspaceId` so "overview" is never read as an id.

**Response** — `ApiResponse.success`, `data`:

```json
{
  "totals": { "workspaces": 6, "projects": 60, "openTasks": 1551, "doneTasks": 321,
              "overdueTasks": 69, "activeSprints": 45 },
  "projectsByStatus": { "BACKLOG": 6, "PLANNING": 13, "ACTIVE": 22,
                        "ON_HOLD": 7, "COMPLETED": 6, "CANCELLED": 6 },
  "workspaces": [
    { "id": "…", "name": "Tizaraa", "icon": "🛠", "color": "#…",
      "members": 1, "activeSprints": 10, "projectCount": 10,
      "projects": { "BACKLOG": 1, "PLANNING": 3, "ACTIVE": 2, "ON_HOLD": 2, "COMPLETED": 1, "CANCELLED": 1 },
      "tasks": { "TODO": 292, "IN_PROGRESS": 42, "COMPLETE": 66 },
      "overdue": 14, "openPoints": 1323 }
  ]
}
```

Every status and group is present with a `0`, so a client never has to tell
"none" from "not sent".

**What is counted, and why:**

- **Aggregated in SQL** (`findOverviewForUser`: three `GROUP BY` queries run
  in parallel, each one round trip). Loading rows to count them in Node is
  hundreds of tasks across six workspaces for a handful of integers.
- Archived and soft-deleted projects are excluded, as they are from the
  projects list. Every member sees every project in a workspace
  (project.md §Guards), so there is no per-project filter.
- **Top-level tasks only** (`parentId IS NULL`) — the same rule as sprint
  roll-ups and the backlog count, so the dashboard and those screens agree.
- **Overdue** = a due date before today (UTC day boundary) on a task not in a
  Complete-group status — the reading `lib/task-delay.ts` uses on the frontend.
- **`openPoints`** sums story points of To-do and In-progress tasks only;
  unestimated tasks add nothing rather than being guessed.
- Not cached: three parallel aggregates cost one round trip, and a cache here
  would need a version bump from every task, project, sprint and membership
  write in every workspace the user is in.

**Errors:** `401` unauthenticated.

---

## 3. `GET /api/v1/workspaces/:workspaceId`

Fetches one workspace. Any member. `loadMembership`. `apiLimiter`.

**`200`** — same shape as one item of §2's `data` array.

**Errors**

| Status | When |
|---|---|
| `404` | Not a member, or the workspace does not exist, or it is soft-deleted — all three are the same response on purpose (§*Guards*). |

---

## 4. `PATCH /api/v1/workspaces/:workspaceId`

Updates workspace fields. OWNER/ADMIN. `loadMembership` +
`requirePermission(WORKSPACE_UPDATE)`. `apiLimiter`.

| Field | Rules |
|---|---|
| `name` | string, 2–80, trimmed, optional |
| `description` | string, ≤500, nullable, optional |
| `icon` | string, ≤8 chars, nullable, optional |
| `color` | string, `/^#[0-9a-fA-F]{6}$/`, nullable, optional |
| `settings` | object, optional — stored as-is; this module does not validate its internal shape, since it has no opinion on what a caller stores there yet |

At least one field required — an empty body is `400`, not a silent no-op.
`slug` and every billing field are absent from this schema: not "optional and
ignored", genuinely not accepted, so a client cannot depend on being able to
rename the slug later just because the field happens to pass through Joi's
default `stripUnknown` behavior.

**`200`** — same shape as §1's `data.workspace`.

**Errors**

| Status | When |
|---|---|
| `400` | Validation failed, or body is empty. |
| `403` | `FORBIDDEN` — a member, but MEMBER role. |
| `404` | Not a member / does not exist (§*Guards*). |

---

## 5. `PATCH /api/v1/workspaces/:workspaceId/archive`

Sets or clears `isArchived`. OWNER/ADMIN. `loadMembership` +
`requirePermission(WORKSPACE_UPDATE)`. `apiLimiter`.

| Field | Rules |
|---|---|
| `isArchived` | boolean, required |

A dedicated endpoint rather than folding this into §4's body: archiving is a
state transition a UI fires from one button, not a field a form edits
alongside five others, and keeping it separate means its own audit-log entry
later does not have to guess which PATCH calls were "an archive" versus "an
edit that happened to include `isArchived`."

**`200`** — same shape as §1's `data.workspace`.

**Errors**

| Status | When |
|---|---|
| `400` | Missing/non-boolean `isArchived`. |
| `403` | `FORBIDDEN`. |
| `404` | Not a member / does not exist / already soft-deleted. |

---

## 6. `DELETE /api/v1/workspaces/:workspaceId`

Soft-deletes the workspace — sets `deletedAt`, excludes it from every read
this module performs from then on. **OWNER only.** `loadMembership` +
`requirePermission(WORKSPACE_DELETE)`. `apiLimiter`.

No body. Nothing is hard-deleted: memberships, invitations and (once it
exists) project data are left in place for now. A purge job is out of scope
for this module — see §*Open questions*.

**`200`**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Workspace deleted",
  "data": null
}
```

**Errors**

| Status | When |
|---|---|
| `403` | `FORBIDDEN` — OWNER-gated; ADMIN gets this even though ADMIN can archive. |
| `404` | Not a member / does not exist / already soft-deleted (repeat-call safe: a second delete is a `404`, not a `200` — unlike `auth`'s idempotent-by-design endpoints, there is no "desired end state already holds" argument here, since the caller can no longer prove membership once `deletedAt` is set and `loadMembership` runs first). |

---

## The member roster is not in this module

`GET /api/v1/workspaces/:workspaceId/members` is served by
`src/modules/member/` and documented in [member.md](./member.md) §1, along with
the role-change and removal endpoints on the same path.

It was briefly implemented here — `workspace.controller.listMembers`, never
documented in this file — and moved unchanged: same path, same `200`, same
`{ members: [...] }` body. It moved because that module owns the roster's
*writes*, and a resource whose read is in one module and whose writes are in
another has two owners and therefore none.

Nothing about the workspace endpoints below changed with it.

---

## Open questions

Not decided by this contract, flagged rather than silently assumed:

1. **Hard-delete / purge.** Nothing ever removes a soft-deleted row. Needs a
   retention policy before it matters in practice.
2. **Seat limits.** `seatLimit` exists on the schema but nothing checks it —
   member-invite flows in `invitation.md` are unaffected by workspace plan
   today.
3. **Transfer ownership.** No endpoint changes who holds `OWNER`. Until one
   exists, an OWNER leaving a workspace (once member-removal supports
   self-removal) needs a rule this contract does not yet state.

---

## Files

| Path | Holds |
|---|---|
| `src/modules/workspace/workspace.routes.js` | endpoints, guard/limiter order |
| `src/modules/workspace/workspace.controller.js` | `req`/`res`, nothing else |
| `src/modules/workspace/workspace.service.js` | business rules; throws `AppError` |
| `src/modules/workspace/workspace.repository.js` | every Prisma call, including the owner-membership insert |
| `src/modules/workspace/workspace.dto.js` | `toWorkspace(row, role)` whitelist |
| `src/modules/workspace/workspace.validator.js` | Joi schemas; body/query normalization |
| `src/shared/utils/slug.js` | `generateSlug`, collision retry loop |
| `src/shared/middlewares/permission.js` | `loadMembership`, `requirePermission` (existing, reused) |
| `src/shared/constants/roles.js` | `WORKSPACE_VIEW/UPDATE/DELETE` permissions (existing, reused) |
