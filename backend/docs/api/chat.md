# `chat` — API + events contract

**Module:** `src/modules/chat/` · **REST prefix:**
`/api/v1/workspaces/:workspaceId/messages` · **Socket namespace:** `/chat`

> **STATUS: SHIPPED.** One channel per workspace, and that is the whole model.
>
> It got there the long way: per-project channels first, then workspace channels
> beside them, then the project half removed at the product's request. §0 keeps
> the record, because the shape of the schema only makes sense next to it.
>
> Written as a proposal before any code existed and reconciled against the
> build: where the two differed the difference is noted in place rather than
> quietly edited away.

---

## 0. One channel per workspace, and the table that came and went

**Every member of a workspace shares one conversation. There is no per-project
chat.** Project channels shipped, lasted a day, and were removed: two channels
meant two places to look for the same conversation, and the narrower one kept
excluding exactly the people a message was about.

The schema went with them, twice:

| Shape | While it lasted | Why it changed |
|---|---|---|
| `Message.projectId` | the first cut | one audience, one column — correct at the time |
| `Channel` + `Message.channelId` | one day | two audiences made "which conversation is this" a real question; two nullable columns on `messages` would have put the XOR on the table read on every page, and `message_reads` would have needed partial unique indexes Prisma cannot declare |
| **`Message.workspaceId`** | now | one audience again. A table whose every row is `(id, workspaceId)` answers a question nobody is asking |

**Restoring `Channel` is the first step of adding a second kind of channel
back** — that is the note left in `prisma/schema.prisma`, so the next person
does not rediscover the argument from scratch.

Both restructures were free of data migration because they happened with zero
messages written. Each migration says so at its top; on a populated database
the second would have had to decide what becomes of project-channel messages,
which have no workspace conversation to be merged into.

## 1. Access control, stated once

**Every member of the workspace may read and write its channel. Nobody else
may do either.** Membership is resolved by
`shared/services/workspace-access.js`, and the only tier above it is
moderation: OWNER or ADMIN may delete somebody else's message, the same pair
that may remove a member.

That is the entire access model. What follows was the PROJECT ladder, kept
because it is what the project middlewares still apply everywhere else in the
app — chat no longer consults it:

| Who | Source |
|---|---|
| the project's owner | `project.ownerId === userId` |
| anyone with a `ProjectMember` row | MANAGER or COLLABORATOR |
| a workspace role holding `projects.manage` | the admin escape hatch — [role.md](./role.md) §1 |

That ladder is `loadProject` + `requireProjectContribute`. Today it exists only
as Express middleware, which a socket cannot call — and the two halves do not
even live together: `loadProject` is in `shared/middlewares/project.js`,
`requireProjectContribute` and `markProjectWriter` in
`shared/middlewares/task.js`, where they landed because the task module was
their first caller. They move to `project.js` with this work; they have nothing
to do with tasks.

**A workspace member who is not on the project cannot read the channel.** The
project ladder's step 4 makes such a person a read-only *viewer of the project*
— projects are visible workspace-wide — but `requireProjectContribute` refuses
them, and chat uses `requireProjectContribute`. That is deliberate: a channel is
a conversation between the people doing the work, and "everyone in the workspace
can read every project's chat" is a property that only gets discovered after
something private has been said in one.

**The refactor this module requires** — new code, not a description of what is
there: extract the body of `loadProject` into a plain
`resolveProjectAccess(userId, projectId)` in
`shared/services/project-access.js`, returning
`{ project, membership, projectMember, projectRole, canContribute, canWrite } | null`
— the two flags computed once, where the ladder is, rather than re-derived by
each transport. `loadProject`
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
  server.js         the `io` singleton — setIo / getIo
  auth.js           the handshake middleware (moved, unchanged)
  rooms.js          projectRoom(id) / userRoom(id) — one place names a room
  emit.js           emitToUser / emitToProject
  chat.namespace.js this module's handlers
```

**`server.js` was not in the plan and is not optional.** `index.js` imports
`chat.namespace.js` to register it, and `chat.namespace.js` imports `emit.js` to
broadcast — so a singleton living in `index.js` is an import cycle, which ESM
resolves by handing one side a half-initialised module. The symptom would be
`getIo()` returning `undefined` depending on module load order: a broadcast that
silently does nothing, intermittently, in production. A state module with two
functions and no imports of its own removes the possibility.

`src/config/socket.js` is **deleted**. `index.js` and `notification.service.js`
import from `src/realtime/` directly; the planned one-release shim was skipped
because both callers were updated in the same change.

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

`channel:<workspaceId>`, joined only after `chat.service.js#requireChannel`
says the socket's user is a member. A socket may hold several — one tab, two
workspaces open.

Named `channel:` rather than `workspace:` so that a chat broadcast and a
notification (`user:`) are never confused at a call site.

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
| → server | `channel:join` | `{ workspaceId }` → ack `{ workspaceId, name, users }` |
| → server | `channel:leave` | `{ workspaceId }` |
| → server | `message:send` | `{ workspaceId, content, clientId }` |
| → server | `message:edit` | `{ messageId, content }` |
| → server | `message:delete` | `{ messageId }` |
| → server | `typing:start` / `typing:stop` | `{ workspaceId }` |
| → server | `presence:list` | `{ workspaceId }` (ack-style) |
| ← client | `message:new` | the message DTO + `clientId` |
| ← client | `message:edited` | the message DTO |
| ← client | `message:deleted` | `{ id, workspaceId }` |
| ← client | `typing` | `{ workspaceId, userId, name, typing: bool }` |
| ← client | `presence` | `{ workspaceId, users: [{ id, name, email, avatarUrl }] }` |
| ← client | `chat:error` | `{ event, code, message }` |

**EVERY PAYLOAD NAMES THE WORKSPACE.** There is one channel per workspace, so
the workspace IS the address — nothing is handed out for a client to hold, and
membership is re-checked on every event regardless. A `projectId` where a
`workspaceId` belongs is a `VALIDATION_ERROR`, which is what a client written
against the previous shape now gets.

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

### Acks

Every client→server event also answers through Socket.IO's ack callback when
the client passes one — `channel:join` returns `{ projectId, users }`,
`message:send` returns `{ message, clientId }`. The broadcast is still the
contract; the ack exists so a sender knows its own write landed without having
to match its `clientId` against a room broadcast it may also receive.

A refusal is `chat:error` and NOT an ack, so a client that only awaits the
callback must also listen for `chat:error` — that asymmetry is deliberate: an
error is interesting to the client that caused it AND, in a shared room, worth
surfacing once rather than per-listener.

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

### `GET /api/v1/workspaces/:workspaceId/messages`

`authGuard` → `loadProject`, then the gate in `chat.service.js#requireChannel`.
`200`.

**Divergence from the plan: `requireProjectContribute` is NOT in the chain.**
The tier it applies is the right one, but it answers `403`, and for a channel
the answer has to be `404` — a `403` confirms to somebody with no access that
the project has a conversation, which is the leak §1 refuses. The service reads
`canContribute` off the same resolver and returns the same `404` a non-existent
project gets. It also keeps the two transports honest: the socket half has no
middleware to hang a guard on, so putting the gate in the service is what makes
"the REST check mirrors the socket one" true by construction.

| Query | Default | Notes |
|---|---|---|
| `limit` | 30 | 1–100 |
| `cursor` | — | opaque string from a previous page's `nextCursor`; returns messages strictly older |

Newest-first. `nextCursor` is the encoded position of the last row returned, or
`null` at the beginning of the channel.

**The cursor is `(createdAt, id)`, base64-encoded, and opaque.** A timestamp
alone is not a position: two messages can share a millisecond — one `message:send`
burst is enough — and a strict `createdAt <` comparison then either drops the
tie-mate or repeats it. The query is the row-value comparison
`(createdAt, id) < (cursorAt, cursorId)` ordered by the same pair descending,
which `@@index([projectId, createdAt])` serves with the `id` tiebreak resolved
from the same index entry. Opaque because a client that can parse a cursor will
eventually construct one, and from that day the encoding is a public format.
A malformed cursor is `VALIDATION_ERROR`, never a silent first page — a client
that thinks it is paging while re-reading the head loops forever.

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
    "nextCursor": "MjAyNi0wOS0yMVQxMDoxOToyMi4wNDdafGNtdeKApg=="
  }
}
```

A tombstone: `{ "id": "…", "content": null, "deleted": true, "sender": {…} }`.
A departed sender: `"sender": null`.

| Failure | Status | code |
|---|---|---|
| not a workspace member, or no such workspace | `404` | `NOT_FOUND` |
| bad `limit` / malformed `cursor` | `400` | `VALIDATION_ERROR` |

**`404`, not `403`, for a non-member** — the same rule `loadMembership` already
applies: confirming a workspace exists to someone with no access to it is
itself a leak.

### `GET /api/v1/workspaces/:workspaceId/messages/unread-count`

`200` with `{ count }`. Messages in the channel newer than the caller's
watermark, excluding their own and excluding tombstones. No watermark yet means
the whole channel counts as unread.

### `GET /api/v1/chat/unread`

The bell's summary: every workspace the caller is a member of that has unread
messages. Person-scoped, no id in the path, no limiter (ambient, like
`/notifications`).

```json
{ "workspaces": [{ "workspaceId": "…", "name": "Acme", "icon": "🚀", "count": 3 }] }
```

Workspaces with nothing unread are omitted. Kept fresh by the `chat:unread`
nudge: after a `message:send` is persisted and broadcast, every other member of
the workspace gets `chat:unread` `{ workspaceId }` on the ROOT namespace (their
`user:<id>` room), and the client re-reads this endpoint.

### `POST /api/v1/workspaces/:workspaceId/messages/read`


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

---

## 7. What the build changed, and what held

**Held:** persist-before-broadcast; the sender from the socket and never the
payload; membership re-checked on every write; one service behind two
transports; `MessageRead` in the first cut; tombstones with their text dropped
in the DTO.

**Changed, in order of how much it matters:**

1. **The REST guard chain**, §4 — `403` from a shared middleware was the wrong
   answer for a channel.
2. **The cursor**, §4 — `(createdAt, id)` rather than a bare timestamp, because
   two messages can share a millisecond.
3. **`server.js`**, §2 — an import cycle that would have made broadcasts
   silently no-op.
4. **`requireProjectContribute` and `markProjectWriter` moved** from
   `shared/middlewares/task.js` to `project.js`. Neither knows what a task is,
   and chat was the second caller.

**One bug worth recording**, found by the two-client verification and not by
reading: the namespace originally awaited a display-name query before
registering its listeners. Socket.IO does not queue an event for a listener
that does not exist yet, so a client emitting `channel:join` on connect — which
every client does — had that join dropped, with no error anywhere and a channel
that simply looked empty. Nothing is awaited before `registerHandlers` now, and
`chat.namespace.js` says why in place.

---

## 8. History of the shape, in three moves

1. **Per-project channels.** `Message.projectId`, gated by the project
   contribute tier. Verified, shipped, and immediately the wrong unit: the
   people a message concerned were often not on the project.
2. **Both, on a `Channel` row.** Workspace channels added beside project ones;
   the target became an entity because there were two of them.
3. **Workspace only.** Project chat removed, `Channel` dropped, the message
   carries its workspace again. One conversation per workspace, one room shape,
   one access rule.

**Verified at each step, and at this one** against a running server with three
clients: the project REST route is gone (`404`); joining by `projectId` is a
`VALIDATION_ERROR`; a member who is on no project is admitted; a non-member is
refused as `NOT_FOUND` on both socket and REST; send, edit (author only),
delete (author or OWNER/ADMIN), typing, presence, history, unread and the
watermark all behave; a tombstone keeps its row and loses its text. 21 checks,
all passing.

**The UI is a page, not a panel** — `/workspaces/:id/chat`, reached from the
sidebar's Chat row. Chat began as a drawer over the board, which is right for a
glance and wrong for the thing people sit in: a drawer has no URL, cannot be a
browser tab, and gives a conversation two thirds of the width it wants.
