# `task` — API contract

**Module:** `src/modules/task/` — `task.*`, `task-comment.*`, `task-activity.*`,
`task-property.*`, `task-status.*` ·
**Route prefixes:** `/api/v1/projects/:projectId/tasks`,
`/api/v1/tasks`, `/api/v1/tasks/:taskId/comments`,
`/api/v1/tasks/:taskId/activity`,
`/api/v1/projects/:projectId/task-properties`,
`/api/v1/projects/:projectId/task-statuses`

> **Sibling-contract check.** Response envelope, `AppError` shape,
> validation-error shape, guard middleware names and rate-limiter precedent all
> match [project.md](./project.md) and
> [project-property.md](./project-property.md): `{ success, statusCode,
> message, data }` from `ApiResponse` (`paginated` for the list), services
> throwing `AppError` with a `data.code`, `validate` producing `400` with a
> per-field `details` array, and `authGuard` / `loadProject` /
> `requireProjectWrite`.
>
> **Deliberate divergences, five of them:**
>
> 1. **Five modules in one folder.** `module-consistency` asks for six files
>    per module; `modules/task/` holds thirty — tasks, comments, activity, the
>    task-property schema and the status list, each with its own six. Same arrangement, same
>    reasoning, as `project-property.*` living in `modules/project/`: comments
>    and task columns mean nothing apart from a task, and folding them into
>    `task.service.js` would put it past 400 lines.
> 2. **A new guard tier, `requireProjectContribute`.** Every project write
>    takes `requireProjectWrite` (owner, MANAGER, workspace OWNER/ADMIN). Task
>    rows take a wider tier that also admits COLLABORATORs. See §Guards — this
>    is the one divergence a reviewer is most likely to "fix".
> 3. **Task property definitions are PROJECT-scoped**, where project property
>    definitions are workspace-scoped. See §Task properties.
> 4. **The list's `limit` caps at 500**, not 100. A backlog is read whole and
>    grouped client-side; paging a list someone is actively reorganising is a
>    worse bug than a larger payload.
> 5. **Comments are hard-deleted.** Tasks soft-delete like every other content
>    row; a comment is not something anybody restores, and a soft-deleted one
>    would have to be filtered out of every thread and every `commentCount`.
> 6. **Reordering is a full-list `PUT`**, where every other module reorders by
>    patching a `position`. See §Statuses — drag and drop is why.
> 7. **Tasks are ranked by NEIGHBOURS, not by a `position` the client sends**
>    (`PATCH /tasks/:id/move`). See §Ordering.
> 8. **Bulk writes exist** (`/tasks/bulk`, `/tasks/bulk-delete`) — no sibling
>    module has them. A backlog is the one screen where people routinely change
>    twenty rows at once.

---

## Task model — read this before any endpoint below

| Field | Notes |
|---|---|
| `id` | cuid. What every URL and mutation is addressed by. |
| `number`, `key` | See §Numbering. `key` is `${project.key}-${number}` — derived, never stored. |
| `title` | 1–200 chars, required. |
| `description` | ≤ 5000 chars, or `null`. An empty string is stored as `null`. |
| `type` | `TASK` · `STORY` · `BUG` · `EPIC`. Defaults to `TASK`. A fixed enum, unlike statuses: "what kind of work is this" must mean the same thing in every project. |
| `storyPoints` | Integer 0–100, or `null`. `null` is "not estimated" and is **not** 0 — sprint capacity must not count an unestimated task as free. |
| `position` | Float backlog rank, lower is higher. Read-only here; written through §Ordering. |
| `icon`, `color` | One emoji (≤ 8 chars) and a `#rrggbb` hex, each nullable; `""` is stored as `null`. Same rules as the project's glyph pair (`project.md`), so a task header and a project header render from the same component. |
| `statusId`, `status` | One of the **project's** status options — see §Statuses. `status` is `{ id, name, color, group }`. Never `null`; omitted on create → the project default. |
| `priority` | `LOW` · `MEDIUM` · `HIGH` · `URGENT`, or **`null`**. Unlike a project, a task may have no priority — defaulting a one-line task to MEDIUM would be a claim nobody made. Same `Priority` enum the project uses (plan project §2.7). |
| `assigneeIds` (write), `assignees` (read) | Zero to 10 users, each a member of the project's **workspace**. Always the WHOLE set: sending `assigneeIds` replaces who is on the task, `[]` unassigns everyone. `assignees` is `[{ id, name, email }]` in the order they were sent, never `null`. See §Assignees. |
| `dueDate`, `completedAt` | ISO timestamps or `null`. See §Status and completedAt. |
| `tags` | Up to 20 free-text labels, each 1–40 chars. Trimmed and de-duplicated case-insensitively, first spelling kept. |
| `attachments` | Array of upload metadata — exactly a FILES property value (`upload.md`), validated by the same `PROPERTY_TYPES.FILES.check`. Always an array in responses. |
| `sprintId`, `sprint` | The sprint it is planned into, or `null` for the backlog. `sprint` is `{ id, name, state }`. Rules in [sprint.md](./sprint.md) §Task membership. |
| `parentId`, `parent` | See §Sub-tasks. `parent` is `{ id, number, key, title }` or `null`. |
| `subtaskCount`, `commentCount` | Live sub-tasks; all comments. |
| `properties` | `{ [taskPropertyDefId]: value }`, only for definitions that still exist. |
| `createdById`, `createdBy` | Who filed it; `createdBy` is `{ id, name, email }`. Both `null` once that account is gone. |
| `createdAt`, `updatedAt` | |

Never in a response: `deletedAt`.

### Numbering

Every task gets the next number from its project's `taskCounter`, allocated by
a single `UPDATE "projects" SET "taskCounter" = "taskCounter" + 1 … RETURNING`
inside the same transaction as the insert (`task.repository.js#createTask`).

- **Not `count(tasks) + 1`.** Two concurrent creates would read the same count
  and both take the same number; the `@@unique([projectId, number])` would then
  fail one of them with a `500`-shaped surprise. The row-locked `UPDATE`
  serialises exactly the one statement that needs it.
- **Numbers are never reissued.** Deleting `TIZ-7` leaves a gap. `TIZ-7` is
  already written in a commit message or a chat thread somewhere; handing it to
  a different task would make that reference lie.
- **A failed insert does not burn a number** — the increment rolls back with it.
- **A task never moves project**, so its number never changes. There is no
  field in any schema that could move it.

### Statuses

A task's status is **data, not an enum**. Each project owns an ordered list of
`TaskStatusOption` rows — "Not Started", "Re-open", "Dev done", "QA passed" —
and every option belongs to one of three **fixed groups**:

| Group | Meaning |
|---|---|
| `TODO` | not begun |
| `IN_PROGRESS` | being worked |
| `COMPLETE` | finished — the only group the backend attaches behaviour to |

- **Names are the project's; groups are the code's.** A team may call its
  workflow anything, so nothing in the server branches on a status *name*.
  Everything that needs to know "is this finished" reads the group. That is
  what lets "Archived" and "Done" both count as complete without a list of
  magic strings.
- **Per project, not per workspace**, for the reason §Task properties gives:
  each backlog is its own database, and one team's "QA passed" is not another's.
- **Exactly one default.** It is where a new task lands when no `statusId` is
  sent, and where a deleted status's tasks move. Making another status the
  default clears the old flag in the same transaction; the default cannot be
  deleted (`422`) until another status takes the role.
- **Seeded lazily.** Every read and write of a project's statuses calls
  `ensureDefaults`, which inserts Not Started (TODO, default) / In Progress /
  Done the first time a project has none. The migration seeded the same three
  for projects that already existed, so a project created later needs no hook in
  the project module. `createMany … skipDuplicates` plus `@@unique([projectId,
  name])` makes two concurrent first reads harmless.
- **Colours are tokens** (`gray brown orange yellow green blue purple pink
  red`), never hex. The frontend owns the palette; a client-supplied hex would
  paint a status in a colour no theme was designed for.
- **Deleting a status moves its tasks to the default, then deletes it**, in one
  transaction. The foreign key is `RESTRICT` — deleting a status must never
  delete work — so soft-deleted tasks are moved too, or they would block it.
- **Ordering is a full-list `PUT`.** Positions are sparse *within a group*.
  The editor reorders by drag and drop, including dragging a status into
  another group; one request carrying the complete list in display order is
  atomic (no half-moved list if the second of two requests fails) and
  idempotent (a drop followed by a correction ends in the correction's state).
  A list that omits or repeats a status is refused rather than merged.

### Status and completedAt

`completedAt` follows the status **group** unless the request sets it:

| Request | Result |
|---|---|
| create with a `COMPLETE`-group status, no `completedAt` | `completedAt` = now |
| patch moves into `COMPLETE` from another group, no `completedAt` in the patch | `completedAt` = now |
| patch moves out of `COMPLETE` to another group, no `completedAt` in the patch | `completedAt` = `null` |
| `COMPLETE` → `COMPLETE` ("QA passed" → "Done"), or any move within a group | unchanged |
| `completedAt` present in the request | exactly what was sent, whatever the status |

Relabelling a finished task does not change when it was finished, which is why
a move inside `COMPLETE` leaves the date alone. Reordering the status list — even
moving a status between groups — rewrites no task's `completedAt`: that is a
change to the workflow, not to anybody's work.

An explicit value always wins so a task finished on Friday and recorded on
Monday can say Friday. The server does not reject `completedAt` on a task that
is not complete — the frontend's "Delay" is computed from it, and refusing a
date someone deliberately entered is the less useful failure.

### Sub-tasks

A task may have one parent, in the **same project**.

- `parentId` pointing at a task in another project, a deleted task, or an id
  that does not exist → `422 Parent task not found in this project`.
- A task cannot be its own parent or its own ancestor → `422 A task cannot be
  its own ancestor`. The service walks **up** from the would-be parent (one row
  per level) rather than down from the task (a tree), capped at 100 levels.
- **Deleting a parent promotes its live children to top-level**, in the same
  transaction as the soft delete. The foreign key's `onDelete: SetNull` only
  fires on a hard delete, which never happens here — without the explicit
  update, children would point at a row the API pretends does not exist.

### Ordering

Tasks carry a float `position`, **global per project** (not per status), so a
task keeps its rank when its status changes. The list returns tasks in
`position` order, `number` breaking ties.

- **Create** puts a task at the bottom: `max(position) + 1024`, read inside the
  create transaction after the project row is locked, so two concurrent creates
  cannot read the same maximum. A new arrival has not been ranked by anyone.
- **Move** (`PATCH /tasks/:id/move`) names the task's new neighbours — `afterId`
  (directly above) and `beforeId` (directly below) — and the server takes the
  midpoint, or ±1024 from the one neighbour given. **The client never sends a
  number.** Two clients holding different stale copies of the list would write
  colliding ranks, and the respacing below would be theirs to get right.
- **Respacing.** A midpoint cannot be halved forever. When the two neighbours
  are closer than `1e-6`, the service respaces every live task in the project to
  1024 apart (one `UPDATE … FROM (ROW_NUMBER())`, order preserved), then takes
  the midpoint. Rare in practice: about forty moves into the same gap.
- Existing tasks were backfilled to `number * 1024` by the migration, which is
  the creation order the list used to show.

### Activity

Every task has an append-only history in `task_activities`:

| `action` | Written when | `field` / `from` / `to` |
|---|---|---|
| `created` | the task is created | all `null` |
| `updated` | a PATCH, move or bulk update changes a field | one entry **per changed field** |
| `commented` | a comment is posted | all `null` |

Tracked fields: `title`, `description`, `type`, `status`, `priority`,
`assignees`, `dueDate`, `storyPoints`, `sprint`, `tags`, `parent`, `attachments`,
`properties`. `assignees` stores the whole list before and after as
`[{ id, name }]`; entries written before multiple assignees existed carry
`field: "assignee"` with a single `{ id, name }` or `null`, and are returned
unchanged. Not tracked: `icon`, `color`, `position` — a rank change is not
something anyone reads history to find.

- **Entries come from comparing two snapshots** of the task (before and after),
  not from the request body. Setting a field to the value it already had
  records nothing.
- **`from` / `to` are display snapshots**: `{ id, name, color }` for a status,
  `{ id, name }` for a person, `{ id, key, title }` for a parent, the raw value
  otherwise. History must still read correctly after a status is renamed or a
  person leaves; resolving ids at read time would rewrite the past.
- **`description` and `properties` record that they changed, never the text**
  (`from` and `to` are `null`). Copying 5000 characters into every entry would
  make this the largest table in the database.
- **Recording is best-effort.** It runs after the task write commits. If the
  history insert fails, the user's change still happened — failing the request
  would report a completed save as failed, and a retry would apply it twice.
  The failure is logged at `error`.

### Assignees

A task can have several people on it — a pairing, a reviewer, a hand-off in
progress. Stored in the `task_assignees` join table (`taskId`, `userId`,
`createdAt`), not a `String[]` of ids on the task, so deleting a user removes
their assignments by foreign key and "tasks assigned to X" is an indexed read.

- **The set is replaced, never patched.** `assigneeIds` is the full list;
  there is no add/remove endpoint. Two people editing the list at once is a
  last-write-wins, the same as every other field on a PATCH.
- **Every id must be a workspace member**, or the whole write is a `422 Some of
  those users are not members of this workspace` — nothing is half-assigned.
- **Duplicates are a `400`** (Joi `unique`), not silently collapsed: a client
  sending the same person twice has a bug worth seeing.
- Replaced `assigneeId` / `assignee` (one person). Migration
  `20260916100000_task_multiple_assignees` copied every existing assignee
  across before dropping the column.

### Soft delete

`DELETE /tasks/:id` sets `deletedAt`. Every read filters it out
unconditionally, so a deleted task `404`s everywhere, and a second delete is a
`404`, not an idempotent `200` — the same rule `project.md` states. A task in a
soft-deleted project is unreachable too: `loadTask` requires both to be live.

### Sprints

A task's container is the nullable `sprintId` — see [sprint.md](./sprint.md)
§Task membership. It is accepted on create, PATCH, move (§8b) and bulk update
(§8c); the sprint must be this project's and not completed (`422`), and a
task's live sub-tasks follow it into and out of a sprint.

---

## Task properties

A project's tasks can carry user-defined columns ("Tutorial minutes",
"Customer"). Same design as `project-property.md` — **definitions are rows,
values are a `jsonb` map on the task**, `null` in a patch deletes a key, an
unknown definition id is a `422`, deleting a definition orphans values rather
than rewriting every task, and `type` is immutable — with one difference:

**Definitions belong to the PROJECT, not the workspace.** A project's backlog
is its own database. A workspace-scoped task column would put one team's
"Tutorial minutes" on every other project's tasks, and renaming it would be a
negotiation between teams that never asked for it. Project columns are a
different question: projects in a workspace are compared against each other
(one table, one board), tasks from different projects are not.

The value rules — including the ten types and the FILES shape — are the shared
table in `shared/constants/propertyTypes.js`. There is no second copy.

---

## Guards

Resolved by `shared/middlewares/project.js` and `shared/middlewares/task.js`.

| Step | Rule |
|---|---|
| 1 | Not a member of the project's workspace → **404**, never 403. Same for a deleted task or project, or an id that never existed. |
| 2 | Workspace OWNER/ADMIN (`PROJECT_MANAGE_ANY`) → may do everything below. |
| 3 | Read (any `GET`) → any workspace member. |
| 4 | **Contribute** — create, update, move, delete a task (singly or in bulk); post or edit a comment → project owner or **any** `ProjectMember` (MANAGER *or* COLLABORATOR). |
| 5 | **Write** — create, rename, delete a task property; create, edit, reorder, delete a status → project owner or MANAGER (`requireProjectWrite`). Moving a *task* to another status is step 4. |
| 6 | Delete a comment → its author, or anyone who passes step 5. Edit a comment → its author only. |

**Why collaborators may write tasks but not the project.** A COLLABORATOR is
someone added to the project to do the work. `requireProjectWrite` is the right
gate for the project's own record — its name, dates, members, and its task
*schema*, which changes every task in the project. It is the wrong gate for the
work itself: a collaborator who can read the backlog but cannot file a task or
move one to Done is not collaborating. So task rows sit one tier below the
project, exactly as project property *values* sit below the workspace's
property *schema*.

A workspace MEMBER who is not on the project stays read-only, as they are for
the project itself.

**Why comment delete is a flag, not a gate.** Whether a caller may delete a
comment depends on who wrote it, which no middleware has loaded.
`markProjectWriter` stamps `req.canWriteProject` without rejecting, and the
service compares the author. A role check in a service is what `project.js`
exists to prevent; a gate would lock authors out of their own comments.

## Rate limiting

None, matching `project.routes.js` today. Every write here is authenticated,
membership-checked and scoped to one project. This is a known gap shared with
the project module, not a decision specific to tasks — when `apiLimiter` is
applied to project routes it should be applied here in the same change.

## Caching

Nothing here is cached. Task state changes on every drag and every status
click; a stale hit would show a task in the wrong column to the person who just
moved it.

---

## 1. `GET /api/v1/projects/:projectId/tasks`

**Guards:** `authGuard`, `loadProject`.

**Query**

| Param | Type | Default | |
|---|---|---|---|
| `page` | int ≥ 1 | 1 | |
| `limit` | int 1–500 | 200 | See divergence 4. |
| `statusId` | status option id | — | |
| `q` | string ≤ 200 | — | Case-insensitive match on `title`. |
| `parentId` | task id, or `none` | — | `none` → top-level tasks only (a query string has no `null`). |

**200** — `paginated`: `data` is the **array** of tasks in backlog rank order
(`position`, then `number` — see §Ordering), plus
`pagination { page, limit, total, totalPages }`.

**Errors:** `401`; `404 NOT_FOUND` (step 1); `400 VALIDATION_ERROR` on a bad query.

## 2. `POST /api/v1/projects/:projectId/tasks`

**Guards:** `authGuard`, `loadProject`, `requireProjectContribute`, `validate`.

**Body**

```json
{
  "title": "Fix focus trap in pricing dialog",
  "description": "Tab escapes on Safari 17.",
  "type": "BUG",
  "storyPoints": 3,
  "statusId": "clw…",
  "priority": "HIGH",
  "assigneeIds": ["clu…", "clv…"],
  "dueDate": "2026-09-20",
  "completedAt": null,
  "tags": ["Bug", "a11y"],
  "attachments": [],
  "parentId": null,
  "properties": { "clx…": 25 }
}
```

Only `title` is required. No `statusId` → the project's default status.

**201** — `{ task }`. The task's `status` arrives embedded:

```json
{ "statusId": "clw…", "status": { "id": "clw…", "name": "Not Started", "color": "gray", "group": "TODO" } }
```

**Errors**

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Shape — with per-field `details`. |
| 401 | `UNAUTHORIZED` | |
| 403 | `FORBIDDEN` | Workspace member not on the project (step 4). |
| 404 | `NOT_FOUND` | Step 1. |
| 422 | `VALIDATION_ERROR` | `That status does not exist in this project`; an assignee not in the workspace; parent not in the project; an attachment that is not an uploaded file; a property value that fails its type, or an unknown property id. |

## 3. `GET /api/v1/tasks/:taskId`

**Guards:** `authGuard`, `loadTask`. **200** — `{ task }`. **404** per step 1.

## 4. `PATCH /api/v1/tasks/:taskId`

**Guards:** `authGuard`, `loadTask`, `requireProjectContribute`, `validate`.

Same fields as create, all optional; `{}` is a `400 Provide at least one field
to update`. Only sent fields are written. `null` clears `description`,
`priority`, `dueDate`, `completedAt`, `parentId`; `[]` clears
`assigneeIds`, `tags` and `attachments`; `properties` is a **partial** map where `null`
deletes a key. `completedAt` follows §Status and completedAt.

**200** — `{ task }`. **Errors:** as §2, plus `422 A task cannot be its own ancestor`.

## 5. `DELETE /api/v1/tasks/:taskId`

**Guards:** `authGuard`, `loadTask`, `requireProjectContribute`.

Soft delete; live sub-tasks are promoted to top-level in the same transaction.
Comments stay attached to the deleted row.

**200** — `data: null`. **404** on a second delete.

## 6. `GET /api/v1/tasks/:taskId/comments`

**Guards:** `authGuard`, `loadTask`.

**200** — `{ comments }`, oldest first, at most 500. Each is
`{ id, taskId, body, authorId, author: { id, name, email } | null, createdAt, updatedAt }`.
`author` is `null` when the account no longer exists.

## 7. `POST /api/v1/tasks/:taskId/comments`

**Guards:** `authGuard`, `loadTask`, `requireProjectContribute`, `validate`.

**Body:** `{ "body": "…" }` — trimmed, 1–5000 chars.

**201** — `{ comment }`. **Errors:** `400`, `401`, `403` (step 4), `404`.

Also writes a `commented` activity entry.

## 7a. `PATCH /api/v1/tasks/:taskId/comments/:commentId`

**Guards:** `authGuard`, `loadTask`, `requireProjectContribute`, `validate`.

**Body:** `{ "body": "…" }` — same rule as create.

**200** — `{ comment }`, with `editedAt` stamped. Every comment carries
`editedAt` (`null` until edited) and the client shows "edited" when it is set.
An edit that silently rewrote the thread would be worse than no edit at all.

**Errors:** `404 Comment not found` (checked first, as for delete); `403
FORBIDDEN` for anyone but the **author** — stricter than delete on purpose. A
project writer may remove what someone said; putting different words under
their name is not moderation.

## 8. `DELETE /api/v1/tasks/:taskId/comments/:commentId`

**Guards:** `authGuard`, `loadTask`, `markProjectWriter`.

**200** — `data: null`.

**Errors:** `404 Comment not found` when the comment is not on this task
(checked **before** authorship, so a comment id from elsewhere is simply not
found); `403 FORBIDDEN` when the caller is neither its author nor a project
writer (step 6).

## 8a. `GET /api/v1/tasks/:taskId/activity`

**Guards:** `authGuard`, `loadTask`, `validate` (no query accepted).

**200** — `{ activity }`, **newest first**, at most 200. Each entry is
`{ id, taskId, actorId, actor: { id, name, email } | null, action, field, from, to, createdAt }`
— see §Activity.

## 8b. `PATCH /api/v1/tasks/:taskId/move`

**Guards:** `authGuard`, `loadTask`, `requireProjectContribute`, `validate`.

**Body** — at least one key:

```json
{ "statusId": "clw…", "afterId": "clx…", "beforeId": null }
```

`afterId` is the task directly above the new spot, `beforeId` the one directly
below; `null` or absent means none on that side. `statusId` moves the task to
another status in the same write, with `completedAt` following §Status and
completedAt. With no neighbours the rank is unchanged.

**200** — `{ task }`. **Errors:** `400` (none of the three keys); `403` (step
4); `404`; `422 Neighbour task not found in this project` (deleted, other
project, or unknown id); `422 A task cannot be placed next to itself`; `422`
for a status not in the project.

## 8c. `PATCH /api/v1/projects/:projectId/tasks/bulk`

**Guards:** `authGuard`, `loadProject`, `requireProjectContribute`, `validate`.

```json
{ "taskIds": ["clx…", "cly…"], "patch": { "statusId": "clw…", "priority": "HIGH", "assigneeIds": [] } }
```

`taskIds`: 1–100 ids (duplicates collapsed). `patch`: at least one of
`statusId`, `type`, `priority`, `assigneeIds`, `storyPoints`, `dueDate`.
`assigneeIds` REPLACES the assignees on every selected task.
Title, description and custom properties are **not** accepted — they are
per-task by nature, and a bulk "set description" is a mistake waiting for a
click.

All rows are written in **one transaction**. `completedAt` is computed per
task, because a selection can span status groups. One activity entry per
changed field per task, inserted together.

**200** — `{ tasks }`. **Errors:** `400`; `403`; `404` (project); `422 Some of
those tasks were not found in this project` — **any** unknown, deleted or
other-project id fails the whole request rather than updating the rest, so the
result is never a partial edit the user did not see; `422` for an assignee or
status as in §2.

## 8d. `POST /api/v1/projects/:projectId/tasks/bulk-delete`

**Guards:** as §8c. **Body:** `{ "taskIds": ["clx…"] }`, 1–100.

Same soft delete and sub-task promotion as §5, for the whole selection in one
transaction. `POST` rather than `DELETE` with a body, because intermediaries
are allowed to drop a `DELETE`'s body.

**200** — `{ deleted: <count> }`. **Errors:** as §8c.

## 9. `GET /api/v1/projects/:projectId/task-properties`

**Guards:** `authGuard`, `loadProject`.

**200** — `{ properties }`, ordered by `position` then `createdAt`. Each is
`{ id, projectId, name, type, options, position, createdAt, updatedAt }`;
`options` is `[]` for SELECT / MULTI_SELECT and `null` for every other type.

## 10. `POST /api/v1/projects/:projectId/task-properties`

**Guards:** `authGuard`, `loadProject`, `requireProjectWrite`, `validate`.

**Body:** `{ name, type, options? }` — the `project-property` create schema,
re-exported rather than copied.

**201** — `{ property }`, appended at the end of the list.
**409 CONFLICT** — `A property called "X" already exists in this project`.

## 11. `PATCH /api/v1/projects/:projectId/task-properties/:propertyId`

**Guards:** `authGuard`, `loadProject`, `requireProjectWrite`, `validate`.

**Body:** any of `name`, `options`, `position`; never `type`.
**200** — `{ property }`. **404** when the property is not in this project;
**409** on a duplicate name; **422** for `options` on a non-select type.

## 12. `DELETE /api/v1/projects/:projectId/task-properties/:propertyId`

**Guards:** `authGuard`, `loadProject`, `requireProjectWrite`.

**200** — `data: null`. Values on tasks are orphaned, not rewritten, and vanish
from every task response immediately.

## 13. `GET /api/v1/projects/:projectId/task-statuses`

**Guards:** `authGuard`, `loadProject`.

**200** — `{ statuses }`, ordered by group (`TODO`, `IN_PROGRESS`, `COMPLETE`),
then `position`, then `createdAt`. Seeds the three defaults first if the project
has none. Each is:

```json
{ "id": "clw…", "projectId": "clp…", "name": "Review", "color": "blue",
  "group": "IN_PROGRESS", "position": 30, "isDefault": false, "taskCount": 4,
  "createdAt": "…", "updatedAt": "…" }
```

`taskCount` counts live tasks — what a delete would move.

## 14. `POST /api/v1/projects/:projectId/task-statuses`

**Guards:** `authGuard`, `loadProject`, `requireProjectWrite`, `validate`.

**Body:** `{ "name": "Review", "color": "blue", "group": "IN_PROGRESS" }` —
`name` trimmed 1–40 (required), `color` a palette token (default `gray`),
`group` required.

**201** — `{ status }`, appended at the end of its group, never the default.
**409 CONFLICT** — `A status called "X" already exists in this project`.

## 15. `PUT /api/v1/projects/:projectId/task-statuses/order`

**Guards:** `authGuard`, `loadProject`, `requireProjectWrite`, `validate`.
Declared before the `/:statusId` routes, so `order` is never read as an id.

**Body:** the COMPLETE list in display order, each with the group it now sits in:

```json
{ "statuses": [
  { "id": "a", "group": "TODO" }, { "id": "b", "group": "TODO" },
  { "id": "c", "group": "IN_PROGRESS" }, { "id": "d", "group": "COMPLETE" } ] }
```

In one transaction every status gets that `group` and `position` =
(index within its group + 1) × 10. No task's `completedAt` changes.

**200** — `{ statuses }`, the full ordered list.
**422** — `Send every status exactly once` when an id is missing, repeated, or
not this project's.

## 16. `PATCH /api/v1/projects/:projectId/task-statuses/:statusId`

**Guards:** `authGuard`, `loadProject`, `requireProjectWrite`, `validate`.

**Body:** any of `name`, `color`, `isDefault: true` (`false` is not accepted —
another status has to take the role). `{}` is a `400`. `group` is not
patchable here; moving between groups is §15.

**200** — `{ status }`. **404** `Status not found` when it is not this project's;
**409** on a duplicate name.

## 17. `DELETE /api/v1/projects/:projectId/task-statuses/:statusId`

**Guards:** `authGuard`, `loadProject`, `requireProjectWrite`.

Moves every task on the status (soft-deleted ones included) to the project
default, then deletes the status — one transaction.

**200** — `data: null`. **404** when it is not this project's; **422** `Make
another status the default before deleting this one`.

---

## Open questions

- **Comment edit history.** An edit stamps `editedAt` but keeps no copy of the
  previous body.
- **Server-side filters** for type, priority, assignee and tag. The backlog
  filters client-side today because it reads the whole project (limit 500).
- **Purge** of soft-deleted tasks and their comments.
- **Orphaned attachments** — the same sweep `upload.md` tracks for property files.
- **Rate limiting** — see §Rate limiting.

## Files

| File | Role |
|---|---|
| `prisma/schema.prisma` | `Task`, `TaskComment`, `TaskPropertyDef`, `TaskStatusOption`, `TaskStatusGroup` |
| `prisma/migrations/20260913042003_task_module/` | additive migration |
| `prisma/migrations/20260913044440_task_status_options/` | hand-edited, data-preserving: seeds three statuses per project, maps the old enum, then drops it |
| `src/shared/constants/taskStatus.js` | groups, colour tokens, `DEFAULT_STATUSES` |
| `src/modules/task/task-status.*.js` | per-project status list |
| `src/shared/middlewares/task.js` | `loadTask`, `requireProjectContribute`, `markProjectWriter` |
| `src/modules/task/task.*.js` | tasks |
| `prisma/migrations/20260915090000_backlog_essentials/` | additive: `type`, `storyPoints`, `position` (backfilled to `number * 1024`), `TaskComment.editedAt`, `task_activities` |
| `src/modules/task/task-comment.*.js` | comments |
| `src/modules/task/task-activity.*.js` | history — written by the task and comment services, read by one GET |
| `src/modules/task/task-property.*.js` | per-project task schema |
| `src/routes/index.js` | the six mounts |
