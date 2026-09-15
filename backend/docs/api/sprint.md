# `sprint` — API contract

**Module:** `src/modules/sprint/` ·
**Route prefixes:** `/api/v1/projects/:projectId/sprints`, `/api/v1/sprints`

> **Sibling-contract check.** Envelope, `AppError` shape, validation-error shape
> and guard names match [task.md](./task.md) and [project.md](./project.md):
> `{ success, statusCode, message, data }`, a `data.code` on every error,
> `validate` producing `400` with per-field `details`, and `authGuard` /
> `loadProject` / `requireProjectWrite`.
>
> **Deliberate divergences, three of them:**
>
> 1. **Sprints are hard-deleted**, where projects and tasks soft-delete — and
>    only a PLANNING sprint can be deleted at all. See §Lifecycle.
> 2. **State changes only through action endpoints** (`/start`, `/complete`),
>    never a PATCH of `state`. Each carries side effects a bare column write
>    would skip.
> 3. **One ACTIVE sprint per project is a partial unique index**, hand-written
>    into the migration, the same arrangement as
>    `invitations_live_email_workspace` in [invitation.md](./invitation.md).

---

## Sprint model

| Field | Notes |
|---|---|
| `id` | cuid. What every URL takes. |
| `number`, `key` | Per-project sequence from `Project.sprintCounter`, allocated by an atomic `UPDATE … RETURNING` like task numbers; never reused. `key` is `SPR-${number}`, derived. |
| `name` | 1–80 chars. Omitted on create → `"<PROJECT KEY> Sprint <number>"`. |
| `goal` | ≤ 500 chars or `null`. |
| `startDate`, `endDate` | `YYYY-MM-DD` or `null`. Optional while PLANNING; **both required to start**. End ≥ start, at most 90 days apart. |
| `capacityPoints` | 0–1000 or `null`. A forecast planning fills against — nothing enforces it. `null` is "not decided", not zero. |
| `state` | `PLANNING` → `ACTIVE` → `COMPLETED`. One way. |
| `startedAt`, `completedAt` | When it actually started and finished, as opposed to the planned dates. |
| `createdById`, `createdBy` | `{ id, name, email }` or `null`. |
| `taskCount`, `doneCount`, `totalPoints`, `donePoints` | Roll-ups over the sprint's **live, top-level** tasks (sub-tasks ride with their parent, so counting both would count the work twice). `done` = a Complete-group status. Unestimated tasks add no points. **Derived on read, never stored** — a stored count is a copy every task write must remember to update. |

**Why dates are days, not timestamps.** A sprint runs over calendar days; a
timestamp would make "ends on the 30th" shift a day for anyone west of UTC.

### Task membership

A task's container is `Task.sprintId` — `null` is the backlog. A task is in
exactly one place (frontend `.claude/rules/workflow.md`), so planning is a
**task move**, not a sprint write:

- `PATCH /tasks/:id/move { sprintId, afterId, beforeId }` — drag into a sprint
  at a rank (task.md §8b).
- `PATCH /projects/:projectId/tasks/bulk { patch: { sprintId } }` — plan a
  selection (task.md §8c).
- `sprintId` is also accepted on task create and PATCH.

Rules the task service applies:

- The sprint must belong to the task's project → else `422 That sprint does not
  exist in this project`.
- A COMPLETED sprint takes no tasks → `422 A completed sprint cannot take tasks`.
- **Sub-tasks follow their parent** into and out of a sprint (every live
  descendant, in the same request). The planning screen shows top-level tasks;
  a parent planned without its pieces would leave its own work on the backlog.
  A new sub-task joins its parent's sprint unless `sprintId` is sent.
- History records a `sprint` field change on the moved task (task.md
  §Activity). Descendants moved with it are not recorded separately.

### Lifecycle

| From | Operation | To | Rule |
|---|---|---|---|
| — | create | PLANNING | always |
| PLANNING | start | ACTIVE | no other ACTIVE sprint in the project; both dates set |
| ACTIVE | complete | COMPLETED | tasks in a Complete-group status stay; **all others return to the backlog** |
| PLANNING | delete | *(gone)* | its tasks return to the backlog (FK `SetNull`) |
| COMPLETED | edit / delete / plan into | — | `409` / `409` / `422` |
| ACTIVE | delete | — | `409` — complete it instead, which says what happened to its work |

**No reopen.** A completed sprint is the record of what a time-box delivered;
reopening it would rewrite that record.

**Completing is one transaction**: returning unfinished tasks and marking the
sprint COMPLETED commit together. Split, a crash between them would leave a
completed sprint holding work no board shows. Returned tasks keep their
comments, history and rank, and get one `sprint → null` history entry each.

**Why one active sprint.** The sprint board draws "the" current sprint; two
running at once in one project would need a picker and a rule for which tasks
a stand-up looks at. The service checks first for a readable `409`; the partial
unique index `sprints_one_active_per_project` is what holds when two starts
race, and its `P2002` reaches the client as the same `409`.

## Guards

| Step | Rule |
|---|---|
| 1 | Not a member of the project's workspace → **404**, never 403. Same for a sprint in a deleted project or an unknown id (`loadSprint`, `shared/middlewares/sprint.js`). |
| 2 | Read (any `GET`) → any workspace member. |
| 3 | **Write** — create, edit, start, complete, delete a sprint → project owner, MANAGER, or workspace OWNER/ADMIN (`requireProjectWrite`). |
| 4 | Move a task into or out of a sprint → the **task** tier, `requireProjectContribute` (any project member). |

**Why sprint writes are stricter than planning.** Starting and completing set
the team's cadence and return work to the backlog for everyone — a lead's call,
the same tier that owns the project's statuses. Deciding which tasks go in is
working the backlog, which collaborators already do.

## Rate limiting

None, matching the project and task routes — the shared gap task.md §Rate
limiting records.

## Caching

None. Sprint state changes the moment someone starts or completes one.

---

## 1. `GET /api/v1/projects/:projectId/sprints`

**Guards:** `authGuard`, `loadProject`, `validate` (query).

**Query:** `state` — `PLANNING` | `ACTIVE` | `COMPLETED`, optional.

**200** — `{ sprints }` in display order: the ACTIVE sprint, then PLANNING by
number, then COMPLETED newest first. Roll-ups for every sprint come from one
query.

## 2. `POST /api/v1/projects/:projectId/sprints`

**Guards:** `authGuard`, `loadProject`, `requireProjectWrite`, `validate`.

```json
{ "name": "Checkout sprint", "goal": "Ship guest checkout", "startDate": "2026-09-21", "endDate": "2026-10-04", "capacityPoints": 30 }
```

Every field optional. **201** — `{ sprint }`, always `PLANNING`.

**Errors:** `400`; `401`; `403` (step 3); `404` (step 1); `422` end before
start, or more than 90 days.

## 3. `GET /api/v1/sprints/:sprintId`

**Guards:** `authGuard`, `loadSprint`. **200** — `{ sprint }`.

## 4. `PATCH /api/v1/sprints/:sprintId`

**Guards:** `authGuard`, `loadSprint`, `requireProjectWrite`, `validate`.

`name`, `goal`, `startDate`, `endDate`, `capacityPoints` — at least one; `null`
clears the nullable ones. The date check runs on the pair the write would
LEAVE (the patch's value, else the stored one).

**200** — `{ sprint }`. **Errors:** `400`; `403`; `404`; `409 A completed
sprint cannot be edited`; `422` dates.

## 5. `POST /api/v1/sprints/:sprintId/start`

**Guards:** `authGuard`, `loadSprint`, `requireProjectWrite`, `validate`.

**Body** (all optional) — `name`, `goal`, `startDate`, `endDate`: the start
dialog is where these are usually settled, so they ride along.

**200** — `{ sprint }` with `state: "ACTIVE"`, `startedAt` stamped.

**Errors:** `409 Only a sprint in planning can be started`; `409 <name> is still
active. Complete it before starting another sprint.`; `422 Set a start and end
date to start the sprint`; `422` dates; `403`; `404`.

## 6. `POST /api/v1/sprints/:sprintId/complete`

**Guards:** `authGuard`, `loadSprint`, `requireProjectWrite`. No body.

**200** — `{ sprint, completed, returned }`: the COMPLETED sprint, how many live
tasks stayed as done, how many returned to the backlog.

**Errors:** `409 Only the active sprint can be completed`; `403`; `404`.

## 7. `DELETE /api/v1/sprints/:sprintId`

**Guards:** `authGuard`, `loadSprint`, `requireProjectWrite`.

**200** — `{ returned }`: live tasks sent back to the backlog.

**Errors:** `409 Only a sprint in planning can be deleted. Complete an active
sprint instead.`; `403`; `404`.

---

## Open questions

- **Carry-over choice on complete** — unfinished work always returns to the
  backlog today; moving it straight into the next sprint is a later option.
- **Sprint board** — `/board/sprint` in the frontend still renders fixtures; it
  should read the ACTIVE sprint's tasks.
- **Velocity** — completed sprints' `donePoints` over time is the obvious
  report, and needs no new data.

## Files

| File | Role |
|---|---|
| `prisma/schema.prisma` | `Sprint`, `SprintState`, `Task.sprintId`, `Project.sprintCounter` |
| `prisma/migrations/20260915120000_sprint_module/` | additive, plus the hand-written `sprints_one_active_per_project` partial unique index |
| `src/shared/constants/sprint.js` | states, `SPRINT_MAX_DAYS` |
| `src/shared/middlewares/sprint.js` | `loadSprint` |
| `src/modules/sprint/sprint.*.js` | the module |
| `src/modules/task/task.service.js` | `checkSprint`, sub-tasks following their parent |
| `src/routes/index.js` | the two mounts |
