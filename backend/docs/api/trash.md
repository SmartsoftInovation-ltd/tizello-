# Trash API

**Module:** `src/modules/trash/`
**Route prefix:** `/api/v1/trash`

> **Sibling-contract check.** Response envelope, `AppError` shape,
> validation-error shape and guard middleware names match the siblings —
> `ApiResponse.success/error` with `{ success, statusCode, message, data }`
> ([api-response](../../.claude/skills/api-response/SKILL.md)), `AppError`
> thrown from the service, Joi via `validate(schema, target)`, `authGuard` from
> `shared/middlewares/auth.js`.
>
> **Deliberate divergences, and why:**
>
> 1. **No `loadProject` / `loadTask`, and this one is forced rather than
>    chosen.** Both middlewares filter `deletedAt: null`, because everywhere
>    else a deleted row must be invisible. They cannot load the rows this
>    module exists to act on. The equivalent ladders are re-stated in
>    `trash.service.js` and pinned by `trash.service.test.js`.
> 2. **No id in any path beyond the entry's own.** Like [search.md](./search.md),
>    the scope is the caller's memberships, resolved from the session.
> 3. **`DELETE` here really destroys the row.** Everywhere else in this API
>    `DELETE` means `deletedAt = now()`. See *Purge*.
> 4. **No rate limiter**, matching the project, task and sprint routes — these
>    are ordinary authenticated reads and writes on rows the caller already
>    owns, not the unbounded scan `searchLimiter` exists for.

---

## What is in the trash — read this before the endpoints

Two kinds: **soft-deleted projects** and **soft-deleted tasks**. Both are rows
carrying a non-null `deletedAt`; nothing else about them was changed on the way
out, which is what makes a restore one field.

**Workspaces are deliberately not listed.** Deleting a workspace is an
OWNER-only act (`workspace:delete`) that takes everything with it, and a
deleted workspace cannot resolve the membership every guard here depends on —
`loadMembership` refuses it. Recovering one is a support operation, not a
button.

**A trashed item inside a deleted workspace is not listed either.** Deleting a
workspace does not stamp its projects, so those projects were never
individually trashed; restoring one into a workspace that no longer exists
would leave it unreachable.

**Deleted tasks in a deleted project are not listed.** Restoring one would put
it back into a project the trash is separately offering to restore, so
recovering a single task would mean restoring two things in the right order.
Restore the project instead and its tasks come back with it — deleting a
project never stamped them.

**Archived is not deleted.** An archived project is live and reachable; it
appears in no trash. That distinction is in `schema.prisma` and is the reason
both flags exist.

---

## Authority

**Restoring takes exactly the authority deleting took.** Any other answer is
wrong in one of two directions: a lower bar lets someone undo a decision they
could not have made, and a higher bar leaves a deletion nobody present can
reverse.

| Entry | Delete is guarded by | So restore and purge require |
|---|---|---|
| Project | `requireProjectOwner` | Workspace `OWNER`/`ADMIN` (via `project:manage:any`), or the project's `ownerId`. A project `MANAGER` is **not** enough. |
| Task | `requireProjectContribute` | The above, **plus** anyone holding a `ProjectMember` row on the task's project. |

**Purge takes the same authority as restore, not more.** Reserving "delete
forever" for owners is tempting and wrong: the row is already deleted, the
destructive act has happened, and purging only gives up the ability to undo it.
Gating it higher leaves contributors a trash they can fill and never empty.

**The role is resolved per entry, not per request.** One caller is routinely a
workspace `ADMIN` in one workspace and a plain `MEMBER` in another, so a single
flag for the whole list would be wrong for half of it.

`canRestore` on each entry runs the same ladder the write endpoints run. It is
a courtesy for drawing the button — **the endpoint still enforces**. It is also
the reason `findDeletedTasks` selects the caller's `ProjectMember` row: without
it every collaborator is told `canRestore: false` for a task the restore
endpoint would happily restore, and the button is hidden from exactly the
person entitled to press it.

## Not found vs forbidden

A row that is gone, never existed, or belongs to a workspace the caller is not
in all answer **`404`** with the same message. Answering `403` for the last
case would confirm the id names something real — the same collapse
`shared/middlewares/project.js` documents.

`403` is reserved for the case where the caller **can see** the entry (it is in
their workspace, and it is in the list they just fetched) but lacks the tier to
act on it.

## Caching

**Nothing here is cached.** Every response is per-caller by construction, and
the list changes the moment anyone deletes or restores anything. A stale trash
is worse than a slow one: it offers to restore a row that is already gone.

---

## 1. `GET /api/v1/trash`

Everything deleted that the caller can see, newest deletion first. Any
authenticated user.

**Query**

| Field | Rules |
|---|---|
| `limit` | Optional integer 1–100, default `50`. **Per kind**, not in total. |

`limit` is per kind so a week of deleted tasks can never push the one project
you are looking for off the list — the same reasoning
[search.md](./search.md) gives for its own.

**`200`**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Trash fetched",
  "data": {
    "projects": [
      {
        "kind": "project",
        "id": "cmtsfjaew000gu6j2ylflhbrv",
        "name": "Demo Test",
        "key": "DT",
        "icon": "🚀",
        "color": "#f5cd47",
        "workspaceId": "cmtr4i04q0003rcj27ut25z6s",
        "workspaceName": "Tizaraa",
        "deletedAt": "2026-09-08T09:01:02.089Z",
        "canRestore": true
      }
    ],
    "tasks": [
      {
        "kind": "task",
        "id": "cmu2j4i450005yxj2f3otn6yf",
        "name": "Draft the import spec",
        "key": "ECS-10",
        "type": "TASK",
        "projectId": "cmttl0zl1000lxej25r5smwrs",
        "projectName": "Ecommerce Corporate Store",
        "workspaceId": "cmtr4i04q0003rcj27ut25z6s",
        "deletedAt": "2026-09-15T10:29:09.520Z",
        "canRestore": false
      }
    ]
  }
}
```

**An entry is not a record.** A trashed thing is recognised and then put back or
destroyed, so an entry carries a label, a key, where it lived, when it went and
whether this caller may act on it — nothing more. A deleted project's
description, dates and roll-ups are irrelevant to that decision, and computing
them would make emptying the bin the most expensive page in the app.

`kind` is on every entry so one list can hold two shapes without the client
inferring the type from which fields happen to be present. `name` carries the
project's name or the task's title, so a row renders without branching.

**Errors:** `400` on a bad `limit`; `401` with no session. Never `403` or `404`
— the caller names nothing.

---

## 2. `POST /api/v1/trash/projects/:id/restore`

Clears `deletedAt`. Workspace `OWNER`/`ADMIN` or the project's owner.

**`POST`, not `PATCH`.** It is not a field being edited; it is an operation with
one meaning — the same shape `/sprints/:id/start` takes.

**`200`** — `{ project: <entry, canRestore: true> }`.

**Idempotence:** restoring an already-restored project answers `404`, because
the row is no longer in the trash. That is the right answer to "put back
something that is not deleted", and it means a double-clicked button reports
"not found" rather than silently succeeding twice.

The project's tasks come back with it: deleting a project never stamped them.

**Errors**

| Status | When |
|---|---|
| `403` | In the caller's workspace, but they are a plain `MEMBER`, or a project `MANAGER` — the owner tier is required. |
| `404` | Not deleted, never existed, in another workspace, or in a deleted workspace. All four are indistinguishable on purpose. |

---

## 3. `POST /api/v1/trash/tasks/:id/restore`

Clears `deletedAt`. Anyone who can contribute to the task's project.

**`200`** — `{ task: <entry, canRestore: true> }`. Same idempotence and the same
error table as §2, with the contribute tier in place of the owner tier.

A restored task returns to the status and sprint it held when it was deleted —
a soft delete changed neither.

---

## 4. `DELETE /api/v1/trash/projects/:id`

**Destroys the row.** Same authority as §2.

This is the one place in this API where `DELETE` is not a soft delete, and it
is the reason the trash exists as a separate module: everywhere else the verb
is a promise that the data is recoverable, and here it is a promise that it is
not.

The cascades in `schema.prisma` do the rest — a purged project takes its tasks,
statuses, sprints and members with it. **There is no undo.**

**`200`** — `{ id, purged: true }`. Errors as §2.

---

## 5. `DELETE /api/v1/trash/tasks/:id`

**Destroys the row.** Same authority as §3. Takes its assignees, comments and
activity with it by cascade. **There is no undo.**

**`200`** — `{ id, purged: true }`. Errors as §3.

---

## Tests

`src/modules/trash/trash.service.test.js` (`npm test`, Node's built-in runner —
no framework, no dependency) pins the permission ladder, including the property
that **contributing is never harder than managing**. The ladder is a
re-statement of `requireProjectOwner` and `requireProjectContribute`, and a
re-statement is exactly the code that drifts: the middleware gains a clause,
the copy here does not, and restoring quietly becomes easier than deleting was.
