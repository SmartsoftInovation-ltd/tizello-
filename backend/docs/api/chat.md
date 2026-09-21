# `chat` — API + events contract

**Module:** `src/modules/chat/` · **REST prefix:**
`/api/v1/projects/:projectId/messages` · **Socket namespace:** `/chat`

> **STATUS: PROPOSED.** This document is the contract under review. No schema,
> module or socket handler described here has been written yet — it exists so
> the decisions can be argued with before there is code to argue about.

> **Sibling-contract check.** Response envelope, `AppError` shape,
> validation-error shape, guard middleware names and rate-limiter precedent all
> match [task.md](./task.md), [member.md](./member.md) and [role.md](./role.md):
> `{ success, statusCode, message, data }` from `ApiResponse`, services throwing
> `AppError` carrying a `data.code` from `AUTH_CODES`, `validate` producing
> `400` with a per-field `details` array, and `authGuard` → `loadProject` →
> `requireProject*` from `shared/middlewares/`.
>
> **Deliberate divergences, five of them:**
>
> 1. **Half this module's surface is not HTTP.** Every other module is
>    request/response. Chat's writes arrive over a socket, and the REST half is
>    history only. The two halves share one service layer — the socket handler
>    is a transport, not a second implementation — so a permission rule cannot
>    be enforced on one and forgotten on the other.
> 2. **Pagination is a CURSOR, not `page`/`limit`.** `task.md` pages with
>    offsets because a task list is a stable set. A chat channel grows at the
>    head while you read it, so offset page 2 would skip whatever arrived since
>    page 1 was drawn — the same reason `notification.md` §3 uses `before`.
> 3. **`senderId` is nullable and `SetNull`**, unlike `Task.createdById`'s
>    equivalent treatment but for a louder reason: a channel is a record of a
>    conversation, and cascading a departed member's messages away rewrites
>    what the remaining members remember agreeing.
> 4. **Writes carry no `apiLimiter`.** They are not HTTP requests and never
>    reach Express middleware. The socket layer gets its own per-connection
>    token bucket — see §*Rate limiting*, which is a rule this module has to
>    invent rather than inherit.
> 5. **No `POST /messages`.** Sending is a socket event. A REST twin would be a
>    second write path with its own broadcast to forget, and the one thing this
>    contract must guarantee is that no message exists without having been
>    broadcast and no broadcast happens without a row.

---

## 1. Access control, stated once

**A project member may read and write that project's channel. Nobody else may
do either.** "Member" is exactly what `shared/middlewares/project.js` already
means by it, and this module does not get a second definition:

| Who | Source |
|---|---|
| the project's owner | `project.ownerId === userId` |
| anyone with a `ProjectMember` row | MANAGER or COLLABORATOR |
| a workspace role holding `projects.manage` | the admin escape hatch — [role.md](./role.md) §1 |

That ladder is `loadProject` + `requireProjectContribute`. Today it exists only
as Express middleware, which a socket cannot call.

**The refactor this module requires:** extract the body of `loadProject` into a
plain `resolveProjectAccess(userId, projectId)` in
`shared/services/project-access.js`, returning
`{ project, membership, projectMember, projectRole } | null`. `loadProject`
becomes a thin wrapper that puts the result on `req`; the socket layer calls
the same function. **One definition, two transports** — duplicating the ladder
into a socket handler is how a channel ends up readable by someone the REST API
refuses.

## 2. Socket layer

### It already exists

`src/config/socket.js` was built for notifications ([notification.md](./notification.md)
§8) and already does the three things Step 2 asks for: JWT verification from
the `tizello_access` cookie, a room per user, disconnect at token expiry,
close-on-shutdown. **Chat extends it; it does not replace it.**

The work is to split it so a third feature — call signaling — costs one file:

```
src/realtime/
  index.js          initSocket(httpServer): builds the Server, registers namespaces
  auth.js           the handshake middleware (moved, unchanged)
  rooms.js          projectRoom(id) / userRoom(id) — one place names a room
  emit.js           emitToUser / emitToProject
  chat.namespace.js this module's handlers
```

`src/config/socket.js` becomes a re-export of `src/realtime/` for one release
so `notification.service.js` and `index.js` keep working, then is deleted.

**Why a namespace (`/chat`) and not more rooms on `/`.** A namespace is its own
event table: `message:send` on `/chat` cannot collide with a call-signaling
event of the same name, and a handler registered on the wrong namespace is a
connection error rather than a silent cross-feature broadcast. Both namespaces
reuse the same handshake middleware — auth is connection-level, not
feature-level.

### Handshake auth

Unchanged from notifications, and deliberately so: the `tizello_access` cookie,
verified with the same `verifyAccessToken` the REST guard uses. **No token in
the handshake payload.** The access token is `httpOnly` precisely so page
JavaScript cannot read it; asking the client to hand one over for a socket
would undo the reason it is. `socket.data.userId` is set at the handshake and
is the only identity this module trusts.

The socket disconnects when the token expires (5 minutes) and the client
reconnects with a fresh cookie — see [notification.md](./notification.md) §8.

### Rooms

`project:<projectId>`, joined only after `resolveProjectAccess` says yes. A
socket may hold several — one tab, several open projects.

**Membership is checked on JOIN, and again on every WRITE.** Join-only would
leave someone removed from a project mid-session broadcasting into it until
they refreshed; re-checking per write costs one indexed lookup against a
channel that is not high-throughput. Read-side is join-gated only: the cost of
a stale reader for the seconds until the server drops them is a message they
could have seen a moment earlier anyway, and it is bounded by the token's own
5-minute life.

## 3. Socket events

Every event is namespaced `<resource>:<action>`. The client emits the bare
action; the server broadcasts the past tense.

| Direction | Event | Payload |
|---|---|---|
| → server | `channel:join` | `{ projectId }` |
| → server | `channel:leave` | `{ projectId }` |
| → server | `message:send` | `{ projectId, content, clientId }` |
| → server | `message:edit` | `{ messageId, content }` |
| → server | `message:delete` | `{ messageId }` |
| → server | `typing:start` / `typing:stop` | `{ projectId }` |
| → server | `presence:list` | `{ projectId }` (ack-style) |
| ← client | `message:new` | the message DTO + `clientId` |
| ← client | `message:edited` | the message DTO |
| ← client | `message:deleted` | `{ id, projectId }` |
| ← client | `typing` | `{ projectId, userId, name, typing: bool }` |
| ← client | `presence` | `{ projectId, users: [{ id, name }] }` |
| ← client | `chat:error` | `{ event, code, message }` |

### `message:send` — persist first, then broadcast

The rule the whole module is built around: **the row is written, and only then
is it broadcast.** A broadcast-first design is faster and wrong — a failed
insert leaves a message on every screen in the room that no history load will
ever return, and the only way to notice is to reload.

`clientId` is an opaque string the sender generates and the broadcast echoes.
It is what lets the sender's own client reconcile the optimistic bubble it drew
with the real row instead of rendering the message twice. The server never
interprets it and never stores it.

**The sender is `socket.data.userId`. Always.** A `senderId` in the payload is
ignored — not validated, ignored — because a payload field that is sometimes
trusted is a field somebody will eventually trust. This is the single most
important line in this document.

### `message:edit` — sender only

Only the author may edit, and the rule has no escape hatch: an admin who could
rewrite somebody's words is a worse problem than an admin who cannot remove
them. Sets `editedAt`; broadcasts `message:edited`. Editing a deleted message
is `NOT_FOUND`, not a resurrection.

### `message:delete` — sender, or someone who can manage the project

The author, the project's OWNER or MANAGER, or a workspace role holding
`projects.manage`. That is `requireProjectWrite`'s ladder, reused.

> **Divergence from the brief, flagged for your call.** The brief says "sender
> or project OWNER/ADMIN". **There is no ADMIN in `ProjectRole`** — it is
> `OWNER | MANAGER | COLLABORATOR`; ADMIN is a *workspace* tier. Mapping
> "OWNER/ADMIN" onto "project OWNER or MANAGER, plus the workspace escape
> hatch" is the reading that matches every other guard in the codebase. Say so
> if you meant workspace ADMIN only.

Soft delete: `deletedAt` is stamped, the row stays, and `message:deleted`
carries the id so clients remove the bubble. History returns tombstones as
`{ deleted: true }` with `content: null` rather than omitting them, so a reply
quoting a removed message does not dangle.

### `typing:start` / `typing:stop` — not persisted

Broadcast to the room excluding the sender. The server holds a short timer per
(socket, project) and emits `typing: false` automatically if no `typing:stop`
arrives — a client that crashes mid-keystroke must not leave "Alice is typing"
on screen forever.

### `presence:list`

Derived from the room's sockets, not from a table. Presence is true only for as
long as a connection is open, so storing it means storing something already
stale — and a crashed tab would leave a ghost until a cleanup job nobody wrote
removed it. Deduplicated by user: three tabs are one person.

### `chat:error`

Never a thrown exception, never a silent drop. `{ event, code, message }` where
`code` comes from `AUTH_CODES`, so a client branches on the same vocabulary as
the REST half.

| Case | code |
|---|---|
| payload fails its schema | `VALIDATION_ERROR` |
| not a member of that project | `FORBIDDEN` |
| unknown message / project | `NOT_FOUND` |
| editing or deleting someone else's | `FORBIDDEN` |
| over the send rate limit | `RATE_LIMITED` |

### Rate limiting

`apiLimiter` never runs — these are not HTTP requests. A per-connection token
bucket (proposed: 20 messages / 10s, burst 5 for typing) lives in the namespace
handler. Without it, one script with a valid cookie can write to Postgres as
fast as the socket accepts, and every other member's browser renders it.

## 4. REST — history

### `GET /api/v1/projects/:projectId/messages`

`authGuard` → `loadProject` → `requireProjectContribute`. `200`.

| Query | Default | Notes |
|---|---|---|
| `limit` | 30 | 1–100 |
| `before` | — | ISO timestamp cursor — returns messages strictly older |

Newest-first. `nextCursor` is the `createdAt` of the last row, or `null` at the
beginning of the channel.

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Messages fetched",
  "data": {
    "messages": [
      {
        "id": "cmu…",
        "content": "Pushed the fix",
        "deleted": false,
        "editedAt": null,
        "createdAt": "2026-09-21T10:19:22.047Z",
        "sender": { "id": "cmt…", "name": "cokof", "email": "cokof@example.com" }
      }
    ],
    "nextCursor": "2026-09-21T10:19:22.047Z"
  }
}
```

A tombstone: `{ "id": "…", "content": null, "deleted": true, "sender": {…} }`.
A departed sender: `"sender": null`.

| Failure | Status | code |
|---|---|---|
| not a project member, or no such project | `404` | `NOT_FOUND` |
| bad `limit` / malformed `before` | `400` | `VALIDATION_ERROR` |

**`404`, not `403`, for a non-member** — the same rule `loadProject` already
applies: confirming a project exists to someone with no access to it is itself
a leak.

### `GET /api/v1/projects/:projectId/messages/unread-count`

`200` with `{ count }`. Messages in the channel newer than the caller's
watermark, excluding their own and excluding tombstones. No watermark yet means
the whole channel counts as unread.

### `POST /api/v1/projects/:projectId/messages/read`

`200` with `{ lastReadAt }`. Upserts the watermark to `now()`, or to a supplied
`at` when catching up to a specific point.

**Idempotent, and it never moves backwards.** A late-arriving request from a
tab that was behind must not un-read what another tab already read.

## 5. Why `MessageRead` is in the first cut

It is one table, one unique index and two endpoints, and it is the difference
between a channel list that shows a bold unread dot and one that does not —
which is the first thing anybody asks for after the messages appear.

Deferring it is not free. Added later, every existing member has no watermark,
so on the day it ships either everyone sees every channel as fully unread, or a
backfill invents a `lastReadAt` nobody chose. Both are worse than a column
written from the start.

**What it is not:** a read receipt. There is no "seen by" list and no per-
message state — see the model comment.

## 6. Caching

Nothing is cached. History is paged from Postgres on demand; live messages
arrive over the socket. An unread count is the definition of a value that must
not be stale.
