# `notification` — API contract

**Module:** `src/modules/notification/` · **Route prefix:** `/api/v1/notifications`

> **Sibling-contract check.** Response envelope, `AppError` shape,
> validation-error shape and rate-limiter precedent all match
> [member.md](./member.md), [role.md](./role.md) and [auth.md](./auth.md):
> `{ success, statusCode, message, data }` from `ApiResponse`, services
> throwing `AppError` carrying a `data.code` from `AUTH_CODES`, and `validate`
> producing `400` with a per-field `details` array.
>
> **Deliberate divergences, four of them:**
>
> 1. **Not workspace-scoped, and `authGuard` alone is the complete guard.**
>    Every other module takes `loadMembership` → `requirePermission`. A
>    notification belongs to a person, who may be in five workspaces and wants
>    one bell — so the owner is `req.user.id` and the scope is the `where`
>    clause on every repository query. **There is no `:userId` in any path
>    here**: a route that took one would be a route somebody could change.
> 2. **No `POST`.** Notifications are not created by a client. They are a
>    side-effect of somebody else's write, raised by `notifyTaskAssigned`,
>    which `task.service.js` calls. An endpoint that minted one would let any
>    user put arbitrary text in anybody's bell.
> 3. **No rate limiter on the reads.** The bell polls `GET /notifications`, and
>    rate-limiting a poll turns a busy tab into a `429` on the one surface
>    meant to be ambient. The two writes carry `apiLimiter` as usual.
> 4. **Sending never throws.** `notifyTaskAssigned` is called *after* the task
>    has been written, and wraps everything in a `try/catch` that logs. This is
>    the one place in the codebase where swallowing an error is correct: a
>    failure in a side-effect must not turn a saved assignment into a `500` and
>    roll the caller's UI back over work that really happened.

---

## 1. What raises one

Today, exactly one thing: **being added to a task**.

`task.service.js` calls `notifyNewAssignees(before, after, project, user)` on
all three write paths — `createTask`, `updateTask` and `bulkUpdateTasks`.

**Newly added, not "everyone on it".** A patch that changes a due date resends
`assigneeIds` unchanged, and notifying the same three people every time anybody
touches the card is how a bell becomes noise. The diff is taken against the row
as it was before the write.

**The actor is never notified.** Assigning yourself a task is not news.

**The sprint name rides along.** It is read once, in `task.service.js`, which
already knows the task and its project — and it is the answer this feature
exists for: *"you were assigned ECS-1 in Sprint 1"*. A task in the backlog
belongs to no sprint, and its notification says so by carrying `sprintName:
null`; the row then falls back to the project name for context.

## 2. Two deliveries, two different rules about freshness

| | in-app row | email |
|---|---|---|
| written | at assign time | rendered at send time |
| task title | **frozen** | **re-read** |
| durable | yes (Postgres) | best-effort (BullMQ) |

The in-app `title` and `body` are denormalized and never recomputed: a
notification is a record of *what somebody was told*, so "cokof assigned you
ECS-1" stays true after the task is renamed. The email reads the task back in
the worker, because an email is read once and should describe the task as it is
when it lands.

**The email enqueue is not awaited.** `emailQueue.add` goes to Redis, and
ioredis *buffers* commands while it reconnects rather than rejecting them — so
a Redis that is down does not fail, it hangs, and awaiting it would hang
`PATCH /tasks/:taskId` behind it. The durable half is the row; a queue that
cannot be reached is a mail nobody gets rather than an assignment nobody can
make.

`send-assignment` runs at **3 attempts**, not the queue's default 5. Nobody is
blocked on it, and five exponential retries per recipient on a bulk assignment
of forty tasks is a real load spike.

## 3. `GET /notifications`

`200` with `{ notifications: [...], unreadCount }`.

| Query | Default | Notes |
|---|---|---|
| `limit` | 20 | 1–50 |
| `before` | — | ISO date **cursor**, not an offset |
| `unreadOnly` | false | |

**`before`, not `page`.** New notifications arrive at the head constantly, so an
offset-based page 2 would skip whatever landed since page 1 was drawn.

**`unreadCount` travels with the list** rather than being a second call: the
badge and the dropdown are drawn from one render, and two endpoints could
disagree by whatever arrived between them.

```json
{
  "id": "cmub3fbr30000kwj2fp7uyq21",
  "type": "TASK_ASSIGNED",
  "title": "cokof assigned you ECS-1",
  "body": "Finalcial Sheet",
  "read": false,
  "readAt": null,
  "taskId": "cmu2f5ggg00048vj2ihu85cle",
  "projectName": "Ecommerce Corporate Store",
  "sprintName": "Sprint 1",
  "actor": { "id": "cmtq…", "name": "cokof", "email": "cokof@example.com" },
  "createdAt": "2026-09-21T10:19:22.047Z"
}
```

## 4. `GET /notifications/unread-count`

`200` with `{ count }`. For a client that wants the badge without the list.

## 5. `PATCH /notifications/:notificationId/read`

`200` with `{ notification }`.

**Idempotent.** A second call on an already-read notification updates nothing
and still answers with the row. Marking read is not a transition anybody can
get wrong twice, and a `409` on a double-tap would be a worse answer than doing
nothing.

**Unknown and somebody-else's are the same `404`.** The repository's
`markRead` is `updateMany`, not `update`, for exactly this: `update` throws
`P2025` when the compound `where` matches nothing, and distinguishing "not
yours" from "does not exist" confirms that an id is live for another user — the
same leak `loadMembership` refuses by `404`-ing a non-member.

## 6. `POST /notifications/read-all`

`200` with `{ count }` — how many were still unread. One `updateMany`.

## 7. Deletion

There is no delete endpoint. `Notification.taskId` is `ON DELETE CASCADE`, so a
notification disappears with the task it points at — a dead link in a list
whose every row is a link is worse than no row. `actorId` is `SET NULL`
instead: the notification outlives the person who caused it, because it still
explains why the reader has the task.

## 8. Realtime (Socket.IO)

`src/config/socket.js`, attached to the same HTTP server `index.js` starts — so
the socket shares the port: one origin for the browser, one CORS rule, and no
second listener to expose or forget to shut down.

**Auth is the access-token cookie, not a token in the handshake.**
`tizello_access` is `httpOnly` precisely so page JavaScript cannot read it, and
a socket that asked the client to hand one over would undo that. The browser
attaches it because cookies ignore PORT — `localhost:3000` and `localhost:5000`
are one host — and because the client sets `withCredentials`. **In production
the two hosts differ, so `COOKIE_DOMAIN` must be set** or the handshake arrives
bare and is refused.

**One room, `user:<id>`, and nothing else.** A notification has an audience of
one, so that is the whole addressing scheme. Rooms per workspace or per project
would each be a new way to leak somebody else's data and none is needed to
deliver "you were assigned a task".

**The socket dies with the token.** The access token lasts five minutes; a
connection authenticated once would otherwise outlive it by hours. Each socket
schedules its own disconnect at `exp`. The client reconnects, and its reconnect
path calls `router.refresh()` first — which goes through Next's proxy, which
renews the session before the render — so the next handshake carries a fresh
cookie. Re-verifying on a timer without disconnecting would be the same work
and would leave a live socket belonging to a revoked session.

### The event

```
notification:new   { unreadDelta: 1 }
```

**A nudge, not the data**, and emitted AFTER the insert. The client's handler is
`router.refresh()`: the badge and the list come back from the same server fetch
that drew them on load. Pushing the row itself would give the screen two
sources of truth for one list, and the one that arrived over a socket would be
the one nothing revalidated. Emitting before the commit would tell a bell to
refetch a list that does not yet contain what it is announcing.

`emitToUser` is a **no-op when no server is attached** — the email worker and
test scripts import the notification service without ever calling `initSocket`,
and a realtime push is a courtesy on top of a row that is already written.

### Degradation

A browser with no WebSocket, a refused handshake, or three consecutive auth
failures all end in the same place: the socket stops and the bell falls back to
refreshing on navigation, which is how it worked before this section existed.
Nothing is lost — the row is in Postgres either way.

## 9. Caching

Nothing here is cached. The unread count is the definition of a value that must
not be stale.
