# `project` — API contract

**Module:** `src/modules/project/` · **Route prefixes:**
`/api/v1/workspaces/:workspaceId/projects` and `/api/v1/projects`

> **Sibling-contract check.** Response envelope, `AppError` shape,
> validation-error shape, guard middleware names and rate-limiter precedent all
> match [auth.md](./auth.md), [invitation.md](./invitation.md) and
> [workspace.md](./workspace.md): `{ success, statusCode, message, data }` from
> `ApiResponse`, services throwing `AppError` with a `data.code`, `validate`
> producing `400` with a per-field `details` array, and `authGuard` /
> `loadMembership` / `requirePermission` from `shared/middlewares/`.
>
> **Deliberate divergences, four of them:**
>
> 1. **`key` IS accepted from the client.** `workspace.md` §*Slug generation*
>    establishes that a human-facing identifier is server-generated and never
>    client-supplied. A project key is the opposite call, on purpose: it is
>    printed on every task id a team ever quotes, so teams care what it says.
>    The cost is a second collision behaviour — see §*Key* below.
> 2. **Ownership is a column AND a mirrored member row.** `workspace.md`
>    §*Membership, not a new model* makes ownership purely a `Membership` row.
>    Here `Project.ownerId` is the authoritative read and a `ProjectMember`
>    row with `role: OWNER` mirrors it, written in the same transaction. The
>    rule that makes the denormalization safe: **authorization reads the
>    column, display reads the rows.** A `projectMember.role === 'OWNER'`
>    check anywhere in this module is a bug.
> 3. **`taskCounter` exists on the row and appears nowhere in this contract.**
>    It shipped ahead of the Task module so `TIZ-1, TIZ-2, …` needed no later
>    migration, and it is now written by that module alone — incremented
>    atomically inside task creation, see [task.md](./task.md) §*Numbering*.
>    No endpoint below reads or writes it and the project DTO still does not
>    return it; a task's number reaches clients as `task.number` / `task.key`.
> 4. **Two route prefixes, one module.** Create and list need a workspace in
>    the path for `loadMembership` to resolve a role against; everything else
>    is addressed by the project's own globally unique id. Same split, same
>    reason, as `invitation.md`.

---

## Project model — read this before any endpoint below

### Three independent axes, three columns

| Column | Reversible | Means |
|---|---|---|
| `status` | yes | Where the work is: `PLANNING` `ACTIVE` `ON_HOLD` `BACKLOG` `COMPLETED` `CANCELLED`. |
| `isArchived` | yes | Filed away. Hidden from the default list; still openable directly, still un-archivable. |
| `deletedAt` | no | Soft-deleted. Excluded from every query this module runs, with no endpoint to undo it. |

**`ProjectStatus` has no `ARCHIVED` member, deliberately.** The original draft
of this model carried both an `ARCHIVED` status and an `isArchived` boolean,
which makes `status = 'ACTIVE'` alongside `isArchived = true` representable and
meaningless. Archiving therefore never writes `status`, and setting a status
never writes `isArchived` — the same reasoning `workspace.md` gives for keeping
archive and delete apart, applied one axis further.

### Key

The task-ID prefix: `TIZ` is what makes a task `TIZ-1`.

1. **Supplied by the client, or derived from `name`.** Derivation takes the
   initials of a multi-word name (`"Tizello Web App"` → `TWA`) or the first
   three characters of a single word (`"Tizello"` → `TIZ`), clamped to 2–5
   characters, falling back to `PROJ` when a name has nothing usable in it.
2. **Two different collision behaviours, and the difference is the whole
   point.** A DERIVED key that collides is retried as `TIZ2`, `TIZ3`, … The
   suffix eats into the base rather than extending past five characters, so
   `ABCDE` retried is `ABCD2`. A SUPPLIED key that collides is a **`409`** —
   silently renaming a value somebody typed is hostile in a way that suffixing
   a value the server chose is not.
3. **Detected by catching Postgres `P2002` on the insert**, never by a
   `SELECT` first: two requests choosing the same base can both pass a
   pre-check and collide anyway, so the pre-check proves nothing. Bounded at 20
   attempts; exhausting it is a `500` and is unreachable outside a test that
   pre-seeds `KEY2`..`KEY21`.
4. **Unique per workspace, not globally** (`@@unique([workspaceId, key])`) —
   two teams may both want `WEB`.
5. **Immutable after create.** `key` is in no update schema. Every task id
   already written into a commit message, a chat log or a bookmark carries the
   prefix; rewriting it orphans all of that, and none of it is in this
   database. Tracked in §*Open questions*.

### Ownership and members

`Project.ownerId` is the owner. A `ProjectMember` row with `role: OWNER` is
written for the same user in the same transaction, so the member list is one
query with one shape rather than a synthesized-owner special case. **Every
authorization decision reads `ownerId`; the row exists for display.** A project
whose `ownerId` has no matching `OWNER` member row is an invariant violation,
never a valid intermediate state, which is why creation and ownership transfer
are both single transactions.

### Dates

`endDate` may not precede `startDate`. On **create**, both dates are in the one
request, so Joi compares them and rejects with `400`. On **update** they may
arrive one at a time, so the comparison is the service's — a patch carrying
only `endDate` is compared against the *stored* `startDate` and rejected with
`422`. A `Joi.ref` cannot do that: it resolves against the request, and on a
one-date patch it resolves to nothing.

---

## Rate limiting

| Limiter | Window / max | Endpoints | Why |
|---|---|---|---|
| `projectCreateLimiter` | 1h / 30 | create | Abuse prevention, not a quota. Three times the workspace budget because projects are created far more often — a workspace is set up once, a project is started; ten per hour would bite a real team laying out a quarter's work in one sitting. |
| `apiLimiter` *(existing, shared)* | 15m / 100 | everything else | General-purpose budget already applied API-wide. |

Both fail closed on a Redis outage, per the existing `failClosed` wrapper —
see [auth.md](./auth.md) §*Rate limiting* for why fail-open is never acceptable
on this codebase's limiters.

---

## Guards — the two-layer ladder

Every endpoint requires `authGuard`. Beyond that, a project request has two
roles in play: the caller's **workspace** role (`Membership.role`) and their
**project** role (`ProjectMember.role`). They resolve in a fixed order:

1. **No workspace membership → `404`.** A non-member never learns the project
   exists; confirming existence is itself the leak, the same refusal `auth.md`,
   `invitation.md` and `workspace.md` all make. A soft-deleted project and an id
   that never existed return byte-identical bodies.
2. **Workspace `OWNER`/`ADMIN` → full access to every project in the
   workspace**, regardless of `ProjectMember`. Without this escape hatch a
   workspace admin can be locked out of a project inside their own workspace by
   a collaborator who removes them, recoverable only from the database. It is
   expressed as the permission `PROJECT_MANAGE_ANY` rather than a hard-coded
   role check, so it is greppable.
3. **Otherwise the project role decides** — the owner and a `MANAGER` may
   write; a `COLLABORATOR` may not.
4. **Workspace `MEMBER` with no `ProjectMember` row → read-only.** Projects are
   visible workspace-wide. There is no `visibility` column in this schema — see
   §*Open questions*.

All of it lives in `shared/middlewares/project.js`, never in a service. A new
file rather than an addition to `permission.js`, which is workspace-scoped by
construction and imported by modules with no concept of a project.

| Middleware | Passes when |
|---|---|
| `loadProject` | The project exists, is not soft-deleted, and the caller has a `Membership` in its workspace. Sets `req.project`, `req.membership`, `req.projectMember`, `req.projectRole`. |
| `requireProjectWrite` | `PROJECT_MANAGE_ANY`, **or** `project.ownerId === user.id`, **or** the caller's `ProjectMember.role` is `MANAGER`. |
| `requireProjectOwner` | `PROJECT_MANAGE_ANY`, **or** `project.ownerId === user.id`. A `MANAGER` is not enough. |

### Workspace permissions this module adds

| Permission | OWNER | ADMIN | MEMBER |
|---|---|---|---|
| `project:view` | ✅ | ✅ | ✅ |
| `project:create` | ✅ | ✅ | ✅ |
| `project:manage:any` | ✅ | ✅ | ❌ |

`project:create` for a plain `MEMBER` is a deliberate default: "only admins may
start a project" is a workflow decision no module should make unilaterally.
Reversing it is deleting one line from `ROLE_PERMISSIONS`.

---

## `viewerRole`

Every project response carries `viewerRole` — the *caller's* effective role in
that project (`OWNER` / `MANAGER` / `COLLABORATOR` / `null`), not a field of the
project. It is `OWNER` when they own it, otherwise their `ProjectMember` role,
otherwise `null` for a workspace member who is not on the project. Same purpose
as `role` on a workspace response: a UI needs to know whether to draw an edit
button without a second call.

---

## 1. `POST /api/v1/workspaces/:workspaceId/projects`

Creates a project and makes the caller its owner. Any workspace member.
`projectCreateLimiter` (1h / 30).

| Field | Rules |
|---|---|
| `name` | string, 2–100, trimmed, required |
| `key` | string, `/^[A-Z][A-Z0-9]{1,4}$/`, optional — derived from `name` when absent |
| `description` | string, ≤2000, optional |
| `status` | one of the six `ProjectStatus` values, default `PLANNING` |
| `priority` | `LOW` `MEDIUM` `HIGH` `URGENT`, default `MEDIUM` |
| `icon` | string, ≤8 chars (room for a multi-codepoint emoji), optional |
| `color` | string, `/^#[0-9a-fA-F]{6}$/`, optional |
| `startDate` | ISO date, optional |
| `endDate` | ISO date, optional, not before `startDate` |

**`201`**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Project created",
  "data": {
    "project": {
      "id": "cmts7xbx900004fj2ff7867yb",
      "name": "Tizello Web",
      "key": "TW",
      "description": null,
      "status": "PLANNING",
      "priority": "MEDIUM",
      "icon": null,
      "color": null,
      "startDate": null,
      "endDate": null,
      "isArchived": false,
      "workspaceId": "cmtqvsgqp0005s4j2j2w4d35e",
      "ownerId": "cmtqvpvzv0000jnj2w70zq9yg",
      "viewerRole": "OWNER",
      "createdAt": "2026-09-08T05:17:43.198Z",
      "updatedAt": "2026-09-08T05:17:43.198Z"
    }
  }
}
```

**Errors**

| Status | When |
|---|---|
| `400` | Validation failed — including `endDate` before `startDate`. |
| `404` | Caller is not a member of the workspace. |
| `409` | `CONFLICT` — a **supplied** `key` is already used in this workspace. A derived key never reaches this. |
| `429` | `RATE_LIMITED`. |
| `500` | Key generation exhausted 20 attempts — see §*Key* step 3. |

---

## 2. `GET /api/v1/workspaces/:workspaceId/projects`

Every project in the workspace, newest first. Any workspace member —
**including projects they are not a member of** (§*Guards* step 4).
`apiLimiter`.

| Query | Rules |
|---|---|
| `page` | int ≥1, default 1 |
| `limit` | int 1–100, default 20 |
| `status` | one `ProjectStatus`, optional |
| `priority` | one `Priority`, optional |
| `includeArchived` | boolean, default `false` |
| `q` | string ≤100 — case-insensitive match on **name or key**; a key is what people actually type, and `TIZ` appears in no project's name |
| `mine` | boolean, default `false` — owned **or** collaborated on; "my projects" that omits the ones you collaborate on answers a different question |

Returns `ApiResponse.paginated`: a `data` array plus
`pagination: { page, limit, total, totalPages }`. Soft-deleted rows are never
included, with or without `includeArchived`.

**Errors:** `400` validation · `404` not a member of the workspace · `429`.

---

## 3. `GET /api/v1/projects/:projectId`

One project. Any member of its workspace. `apiLimiter`.

**`200`** — `{ "data": { "project": { … } } }`, the same shape as §1 with
`viewerRole` resolved for this caller.

**Errors:** `404` for a nonexistent id, a soft-deleted project, **and** a
project in a workspace the caller does not belong to — one body for all three
(§*Guards* step 1) · `429`.

---

## 4. `PATCH /api/v1/projects/:projectId`

`loadProject` + `requireProjectWrite`. `apiLimiter`.

Every create field except **`key`**, all optional, at least one required. An
empty body is a `400` (`"Provide at least one field to update"`), not a no-op
`200` — pressing Save with nothing changed is a caller mistake, and the client
diffs against the row it opened.

Archiving is not reachable here; `status` and `isArchived` are separate axes
(§*Three independent axes*).

**`200`** — `{ "message": "Project updated", "data": { "project": { … } } }`.

**Errors**

| Status | When |
|---|---|
| `400` | Validation failed, empty body, or `key` present. |
| `403` | `COLLABORATOR`, or a workspace `MEMBER` with no project row. |
| `404` | Not a member of the workspace, or no such project. |
| `422` | `endDate` would fall before the **stored** `startDate` (§*Dates*). |
| `429` | `RATE_LIMITED`. |

---

## 5. `PATCH /api/v1/projects/:projectId/archive`

`loadProject` + `requireProjectWrite`. `apiLimiter`. Body: `{ "isArchived": true | false }`,
required — both directions through one endpoint, because un-archiving is the
same operation with the other value, not a second endpoint.

Does not touch `status`. **`200`** with the updated project.

**Errors:** `400` · `403` · `404` · `429`, as §4.

---

## 6. `DELETE /api/v1/projects/:projectId`

`loadProject` + `requireProjectOwner` — deliberately tighter than §4 and §5: a
`MANAGER` may edit a project and may not delete it. `apiLimiter`.

Soft: sets `deletedAt`. Never a hard delete, and **`ProjectMember` rows are
left alone** — a purge policy is an open question, not something this endpoint
decides. A second delete of the same project is a **`404`**, not an idempotent
`200`: every read filters `deletedAt: null`, so the row is gone as far as this
API is concerned.

**`200`** — `{ "message": "Project deleted", "data": null }`.

**Errors:** `403` for a `MANAGER` or `COLLABORATOR` · `404` · `429`.

---

## 7. `GET /api/v1/projects/:projectId/members`

The project's roster. Any member of its workspace — reading the members is as
open as reading the project. `apiLimiter`.

| Query | Rules |
|---|---|
| `page` | int ≥1, default 1 |
| `limit` | int 1–100, default 50 |

Ordered owner first, then by join time. `ProjectRole` is declared
`OWNER, MANAGER, COLLABORATOR` and Postgres orders an enum by declaration
order, so that ordering is the enum's, not a `CASE`.

**`200`** — `ApiResponse.paginated`:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Members fetched",
  "data": [
    {
      "id": "cmts86...",
      "userId": "cmtqvpvzv0000jnj2w70zq9yg",
      "role": "OWNER",
      "createdAt": "2026-09-08T05:24:00.000Z",
      "user": { "id": "cmtqvpvzv0000jnj2w70zq9yg", "name": "Owner", "email": "owner@example.com" }
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 3, "totalPages": 1 }
}
```

`user` is whitelisted to three fields **at the query**, not just in the DTO — a
member list must never be a route to `passwordHash` or `emailVerifiedAt`, and a
`select` guarantees that without trusting a later reader to remember.

The owner always appears here, because their `OWNER` row is written with the
project (§*Ownership and members*). A roster with no `OWNER` row means the
create transaction was broken.

**Errors:** `400` validation · `404` not a workspace member, or no such
project · `429`.

---

## 8. `POST /api/v1/projects/:projectId/members`

`loadProject` + `requireProjectWrite`. `apiLimiter`.

| Field | Rules |
|---|---|
| `userId` | string, required |
| `role` | `MANAGER` \| `COLLABORATOR`, default `COLLABORATOR` |

**`OWNER` is not an accepted value** — the validator rejects it, so §11 is the
only write path to ownership.

**`201`** — `{ "message": "Member added", "data": { "member": { … } } }`.

**Errors**

| Status | When |
|---|---|
| `400` | Validation failed — including `role: "OWNER"`. |
| `403` | `COLLABORATOR`, or a workspace `MEMBER` with no project row. |
| `404` | Not a workspace member, or no such project. |
| `409` | `CONFLICT` — already on this project. |
| `422` | The target user is not a member of the project's **workspace**. Not a nicety: `loadProject` would 404 them anyway, so the row would describe access that does not exist. |
| `429` | `RATE_LIMITED`. |

---

## 9. `PATCH /api/v1/projects/:projectId/members/:userId`

`loadProject` + `requireProjectWrite`. `apiLimiter`. Body: `{ "role": "MANAGER" | "COLLABORATOR" }`,
required.

**`409` when `:userId` is the project owner.** The validator blocks `OWNER` as
an incoming *value*; this blocks the owner as a *target*. Together they leave
§11 as the single write path to ownership.

**`200`** — `{ "message": "Member updated", "data": { "member": { … } } }`.

**Errors:** `400` · `403` · `404` (no such project, or no such member on it) ·
`409` (target is the owner) · `429`.

---

## 10. `DELETE /api/v1/projects/:projectId/members/:userId`

`loadProject` + `requireProjectWrite`. `apiLimiter`.

`409` when `:userId` is the owner, as §9. Removing yourself as a plain member
is allowed; removing yourself as the owner is not — a project with no owner is
not a state this API can produce.

A removed member **keeps read access** if they are still in the workspace
(§*Guards* step 4); what they lose is write.

**`200`** — `{ "message": "Member removed", "data": null }`.

**Errors:** `403` · `404` · `409` · `429`.

---

## 11. `PATCH /api/v1/projects/:projectId/transfer-ownership`

`loadProject` + **`requireProjectOwner`** — deliberately tighter than §§8–10: a
`MANAGER` may add and remove collaborators and may not hand the project to
someone else. `apiLimiter`. Body: `{ "userId": "…" }`, required.

**One transaction, three writes:** `Project.ownerId`, the new owner's member row
upserted to `OWNER`, the outgoing owner's row demoted to `MANAGER`. Between any
two of them the project would have an `ownerId` whose member row says something
else, which is exactly the invariant §*Ownership and members* exists to
prevent — so they commit together or not at all.

The outgoing owner is demoted rather than removed: an ex-owner who silently
loses all access is a support ticket, not a feature.

**`200`** — `{ "message": "Ownership transferred", "data": { "project": { … } } }`.

**Errors**

| Status | When |
|---|---|
| `400` | Validation failed. |
| `403` | Caller is not the owner and holds no `PROJECT_MANAGE_ANY`. |
| `404` | Not a workspace member, or no such project. |
| `422` | Target is not a workspace member, or already owns the project. |
| `429` | `RATE_LIMITED`. |

---

## Custom properties

A workspace can define its own project columns — see
[project-property.md](./project-property.md). Two things that contract adds to
this one:

- Every project response carries **`properties`**, a `{ [definitionId]: value }`
  map filtered to definitions that still exist. `{}` on a project that has set
  none.
- **`POST` and `PATCH` accept `properties`** as a partial map. `null` on a key
  deletes it; an unknown definition id is a `422`; a wrong-shaped value is a
  `422` naming the property.

Definitions are workspace-scoped and admin-only to edit. Setting a *value* is
`requireProjectWrite`, unchanged — adding a column changes every project in the
workspace, filling one in changes one project.

---

## Open questions

1. **Key rename.** Immutable today (§*Key* 5). Making it editable needs a
   task-id backfill and a redirect story, not just an `UPDATE`.
2. **Private projects.** No `visibility` column, so every workspace member can
   read every project. Adding one later is a migration plus a `where` clause in
   one repository function — cheap, and deliberately not guessed at now.
3. **Purge policy.** Soft-deleted projects are never hard-deleted by anything
   here. Same open question `workspace.md` already tracks, and the reason
   §6 leaves `ProjectMember` rows in place.
4. **Cascade on workspace soft-delete.** Soft-deleting a workspace does not set
   `deletedAt` on its projects. They become unreachable through the API — every
   project read goes through workspace membership — but the rows stay live.
   Revisit with the purge policy, not before.

---

## Files

```
prisma/schema.prisma                         Project, ProjectMember, ProjectStatus, Priority, ProjectRole
src/shared/utils/projectKey.js               deriveKey + withUniqueKey
src/shared/middlewares/project.js            loadProject, requireProjectWrite, requireProjectOwner
src/shared/middlewares/rateLimiter.js        projectCreateLimiter
src/shared/constants/roles.js                PROJECT_VIEW / PROJECT_CREATE / PROJECT_MANAGE_ANY
src/modules/project/project.routes.js        two routers
src/modules/project/project.controller.js
src/modules/project/project.service.js
src/modules/project/project.repository.js
src/modules/project/project.dto.js
src/modules/project/project.validator.js
src/routes/index.js                          both mounts
```

Reasoning behind every decision above: [`.claude/plan/project.md`](../../.claude/plan/project.md).
