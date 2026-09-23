# Plan — Chat module

Per-project chat over Socket.IO, on the Express server that already runs. The
contract is already written and committed: [docs/api/chat.md](../../docs/api/chat.md)
(`61138a3`, marked **PROPOSED**). This plan is the build order behind it, plus
the four places where the contract describes a codebase that does not quite
exist yet.

---

## 1. What already exists — read before §2

| Requested step | Status | Where |
|---|---|---|
| 1 — `Message` / `MessageRead` models | **Missing.** §3 is the proposal | `prisma/schema.prisma` |
| 2 — Socket.IO layer, JWT-authenticated | **Two thirds done.** Server, cookie handshake auth, disconnect-at-expiry, graceful close. No namespaces, no rooms but `user:<id>` | `src/config/socket.js` |
| 3 — Chat events | **Missing** | — |
| 4 — REST history module | **Missing** | — |
| 5 — Contract doc | **Done**, 299 lines, ahead of the code | `docs/api/chat.md` |

Reused unchanged, and this module adds no second copy of any of it:

- **`verifyAccessToken`** (`shared/utils/tokens.js`) — already what the socket
  handshake calls. Nothing to do.
- **`loadProject`** (`shared/middlewares/project.js`) — the workspace→project
  role ladder, and the rule that a non-member gets `404`, never `403`.
- **`requireProjectContribute`** (`shared/middlewares/task.js`) — workspace
  OWNER/ADMIN, project owner, or anyone with a `ProjectMember` row. This is the
  chat read/write gate; the chat module does not define a new one.
- **`emitToUser`** / `userRoom` — notifications keep working throughout §4.1.

### Four corrections to the contract doc

The doc was written before this survey. It is right about intent and wrong
about four facts; the doc is amended in sprint 1, not the code bent to match it.

1. **`requireProjectContribute` lives in `shared/middlewares/task.js`**, not
   `project.js`. The doc names it as if it were beside `loadProject`. Moving it
   to `project.js` is the correct fix — it has nothing to do with tasks and is
   already imported by the task module from a file named after a different
   resource — and it is one export line plus three import updates.
2. **There is no `resolveProjectAccess`.** The doc's §1 refactor is real work,
   not a description of the present. §4.2 is where it happens.
3. **`ProjectRole` is `OWNER | MANAGER | COLLABORATOR`** — the doc already
   flags this against the brief's "OWNER/ADMIN". Resolved in §2.3 below;
   confirm or overrule.
4. **A workspace MEMBER with no `ProjectMember` row is read-only on projects**
   (`project.js` ladder, step 4) but `requireProjectContribute` **rejects**
   them. So project-visible-but-not-joined people can see a project and cannot
   read its channel. That is a decision, not a bug — see §2.4 — but it is
   nowhere in the doc.

---

## 2. Design decisions

### 2.1 `MessageRead` ships in the first cut

Agreed with the doc's §5, for the reason it gives: added later, every existing
member has no watermark, and on the day it ships either every channel reads as
fully unread or a backfill invents a `lastReadAt` nobody chose. One table, one
unique index, two endpoints.

### 2.2 The cursor is `(createdAt, id)`, not `createdAt` alone

The doc's §4 pages with `?before=<ISO timestamp>`. Two messages can share a
millisecond — a single `message:send` burst is enough — and a timestamp-only
cursor either drops the tie-mate or repeats it, depending on which side of the
strict comparison it falls.

The cursor is therefore an **opaque string** the client echoes back:
`base64("<createdAt ISO>|<id>")`, and the query is the standard row-value
comparison `(createdAt, id) < (cursorAt, cursorId)` ordered by the same pair
descending. Opaque because a client that parses it will eventually construct
one, and then the format is frozen. `@@index([projectId, createdAt])` serves
it; the `id` tiebreak is resolved from the same index entry.

**This is a change to the published contract** — `before` becomes `cursor`.
Cheap now, expensive after a client ships against it.

### 2.3 Deletion: the author, or someone who could manage the project

`requireProjectWrite`'s ladder — workspace OWNER/ADMIN, project owner, project
MANAGER — plus the author of the message. The brief's "project OWNER/ADMIN"
has no ADMIN to map onto at project level; MANAGER is the tier that means the
same thing here.

Enforced with the **`markProjectWriter` pattern already in `task.js`**: the
ladder stays in middleware as a flag, the author comparison — which needs the
row — stays in the service. On the socket side the same function produces the
same flag, because both call §4.2's resolver.

Editing has no escape hatch at all: the author only. An admin who can rewrite
somebody's words is a worse property than an admin who cannot remove them.

### 2.4 Read access is `requireProjectContribute`, and that excludes lurkers

A workspace MEMBER who is not on the project can open the project (ladder step
4, read-only) and **cannot** open its channel. Chosen deliberately: a channel
is a conversation between the people doing the work, and "everyone in the
workspace can read every project's chat by default" is a surprise that only
gets discovered after something private has been said in one.

Overrule this if channels are meant to be workspace-public — it is one
middleware swap in `chat.routes.js` and the matching branch in the resolver,
and it is much cheaper to decide now than to un-publish later.

### 2.5 Persist, then broadcast. One service, two transports.

The rule the module exists to guarantee: no row without a broadcast, no
broadcast without a row. It survives only if the socket handler is a transport
— parse payload, call `chat.service`, emit what it returns — and never a second
implementation of the same write. Every permission check lives in the service
or in §4.2's resolver, never in the namespace file.

### 2.6 Membership re-checked on every write, join-gated on reads

From the doc, kept: join-only would leave someone removed mid-session
broadcasting into a channel until they refreshed. A per-write check is one
indexed lookup on a low-throughput path. Read-side staleness is bounded by the
5-minute access token that already kills the socket.

### 2.7 Sender identity comes from `socket.data.userId`. Always.

A `senderId` in a payload is dropped by the validator (`.forbidden()`), not
merely ignored — so a client sending one gets a loud `VALIDATION_ERROR` instead
of quietly believing it worked.

---

## 3. Schema — as applied

Migration: **`prisma/migrations/20260923100000_chat_messages`**, applied.

```prisma
/// A message in a project's channel. There is exactly one channel per project
/// and it is not a row: `projectId` IS the channel, so there is no Channel
/// table to keep in sync with the projects it mirrors.
model Message {
  id      String @id @default(cuid())
  // Text, not VarChar: a paste of a stack trace is a normal message. The cap
  // is the validator's (4000 chars), where it can produce a readable error,
  // not the column's, where it produces a 500.
  content String @db.Text

  projectId String
  // Cascade: deleting a project deletes its conversation. A channel outliving
  // its project is unreachable by every read path in this module.
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // Nullable + SetNull, matching TaskActivity.actor and for a louder reason: a
  // channel is the record of a conversation, and cascading a departed member's
  // messages away rewrites what the remaining members remember agreeing. The
  // DTO renders `sender: null`.
  senderId String?
  sender   User?   @relation("MessageSender", fields: [senderId], references: [id], onDelete: SetNull)

  createdAt DateTime  @default(now())
  // Null until edited. The nullable-timestamp rule the whole schema follows:
  // "when" answers "whether" and one question more.
  editedAt  DateTime?
  // Soft delete. The row stays so a reply quoting it does not dangle; the DTO
  // emits `{ deleted: true, content: null }` and never the text.
  deletedAt DateTime?

  // The only read path: one channel, newest first, paged backwards. The `id`
  // tiebreak of plan §2.2 resolves from this index entry.
  @@index([projectId, createdAt])
  @@map("messages")
}

/// One watermark per person per channel — NOT a read receipt. There is no
/// "seen by" list and no per-message state: the unread badge needs a single
/// timestamp, and per-message rows would be one write per member per message.
model MessageRead {
  id String @id @default(cuid())

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // Only ever moves forward — see docs/api/chat.md §4. A late request from a
  // tab that was behind must not un-read what another tab already read.
  lastReadAt DateTime @default(now())

  @@unique([userId, projectId])
  @@map("message_reads")
}
```

Reverse relations:

```prisma
// model User
messages     Message[]     @relation("MessageSender")
messageReads MessageRead[]

// model Project
messages     Message[]
messageReads MessageRead[]
```

No `@@index([userId])` on `MessageRead`: the `@@unique([userId, projectId])`
already leads with `userId` and serves "my watermarks" unaided.

---

## 4. The realtime layer

### 4.1 `src/config/socket.js` → `src/realtime/`

```
src/realtime/
  index.js           initSocket(httpServer) — builds the Server, registers namespaces
  auth.js            the handshake middleware, moved verbatim
  rooms.js           userRoom(id) / projectRoom(id) — one place names a room
  emit.js            emitToUser / emitToProject
  chat.namespace.js  this module's handlers
```

`src/config/socket.js` becomes a four-line re-export for one release, so
`notification.service.js`, `index.js` and `email.worker.js` keep working
untouched; it is deleted in sprint 4 once nothing imports it.

**A namespace (`/chat`), not more rooms on `/`.** `message:send` on `/chat`
cannot collide with a call-signaling event of the same name; a handler on the
wrong namespace is a connection error rather than a silent cross-feature
broadcast. Both namespaces share `auth.js` — auth is connection-level.

The call-signaling feature this is being shaped for costs exactly one file:
`call.namespace.js`, importing the same `auth.js`, `rooms.js` and §4.2.

### 4.2 `shared/services/project-access.js`

```js
resolveProjectAccess(userId, projectId)
  → { project, membership, projectMember, projectRole, canContribute, canWrite } | null
```

Plain async function, no `req`, no `res`, no Express. `loadProject` becomes a
wrapper that puts the result on the request; `requireProjectContribute` and
`markProjectWriter` read the flags it already computed. The socket layer calls
it directly.

One definition, two transports. Duplicating the ladder into a namespace handler
is exactly how a channel ends up readable by someone the REST API refuses.

### 4.3 Rate limiting

`apiLimiter` never runs on a socket — these are not HTTP requests. A
per-connection token bucket in the namespace: **20 messages / 10s**, typing
events **5 / 10s**, both per socket. Over the bucket is `chat:error` with
`RATE_LIMITED`, never a disconnect — a burst is far more often a fast typist
than an attack. Without it, one script with a valid cookie writes to Postgres
as fast as the socket accepts and every member's browser renders it.

---

## 5. Files

| File | Sprint |
|---|---|
| `prisma/schema.prisma`, `prisma/migrations/20260923100000_chat_messages/` | 1 |
| `src/shared/services/project-access.js` | 1 |
| `src/shared/middlewares/project.js` (rewritten as wrappers, gains `requireProjectContribute` + `markProjectWriter`) | 1 |
| `src/shared/middlewares/task.js` (re-exports them for one release) | 1 |
| `src/realtime/{index,auth,rooms,emit}.js`, `src/config/socket.js` shim | 1 |
| `src/modules/chat/chat.{dto,validator,repository,service,controller,routes}.js` | 2 |
| `src/routes/index.js` (mount) | 2 |
| `src/realtime/chat.namespace.js` | 3 |
| `docs/api/chat.md` (amendments) | 1, 3 |

---

## 6. Build order

| Sprint | Delivers | Depends on |
|---|---|---|
| **1 — foundations** | schema + migration, `resolveProjectAccess`, middleware move, `src/realtime/` split with notifications still green, doc corrections | — |
| **2 — REST history** | the six-file chat module: `GET /messages` (cursor), `GET /messages/unread-count`, `POST /messages/read` | 1 |
| **3 — events** | `/chat` namespace: join, leave, send, edit, delete, typing, presence, `chat:error`, token bucket | 1, 2 |
| **4 — close** | delete the `config/socket.js` shim, manual two-client verification, doc `PROPOSED` → shipped, plan §7 | 3 |

REST before sockets deliberately: the service layer is written and exercised
over a transport with an error handler, a test path and a contract before the
socket becomes a second caller of it.

---

## 7. Built — the design held, three corrections and one real bug

All four sprints are in. `docs/api/chat.md` §7 is the reconciliation; this is
the short version.

The shape held: one service behind two transports, persist-before-broadcast,
identity from the socket, `MessageRead` from the start. What changed:

1. **§2.4's rule needed a different status code.** `requireProjectContribute`
   answers `403`, and for a channel that confirms a conversation exists to
   somebody with no access to it. The gate moved into
   `chat.service.js#requireChannel`, which applies the identical ladder and
   returns `404`. The chat routes therefore run `authGuard` → `loadProject` and
   stop — the one module here whose guard chain is deliberately shorter than
   its siblings'.
2. **`src/realtime/server.js` was missing from §4.1.** `index.js` → namespace →
   `emit.js` → `index.js` is an import cycle; a two-function state module
   breaks it. Without it a broadcast silently no-ops depending on module load
   order.
3. **§4.2 grew a second export.** `projectAccessFlags` — the pure half of the
   resolver — because `loadTask` already has the project row from its joined
   query and calling the full resolver would add a third round trip to the
   hottest routes in the app.

**The bug the plan could not have predicted:** the namespace awaited a
display-name query before registering its listeners, so a `channel:join` sent
on connect — what every client does — was dropped with no error and no trace.
Found by the two-client verification in sprint 4, which is the argument for
that sprint existing.

Not built, and still not: notifications for chat messages (§7.5 below),
attachments, and per-message read receipts.

## 8. Widened: the workspace channel

Asked for after the project channel shipped — "a common chat for the whole
workspace, in the sidebar, where every member can talk". It is the same feature
with a second audience, and it cost one table, one resolver and a nav row.

**§2.4's rule survives unchanged and is now visibly a choice rather than the
only option.** A workspace member who is not on a project still cannot read
that project's channel — and now has somewhere they CAN talk to the same
people, which is what made the narrower rule defensible in the first place.

The premise this plan and the contract both argued — "`projectId` IS the
channel, so there is no Channel table" — did not survive, and
`docs/api/chat.md` §0 is the record of why: with two kinds of target, the XOR
has to live somewhere, and the choice was between the channel row and two
nullable columns on the two tables that are read on every page. The second
would also have needed partial unique indexes for the watermark, which Prisma
cannot declare.

Free of data migration because it shipped with zero messages written. That is
stated at the top of `20260923120000_workspace_channels/migration.sql`, because
the same change on a populated database needs a channel per distinct project
first.

## 9. Open questions — answered during the build

1. **§2.2** — cursor changed from `before=<ISO>` to an opaque `cursor`. **Done**,
   and verified against two messages written in the same millisecond.
2. **§2.3** — delete = author + project OWNER/MANAGER + workspace OWNER/ADMIN.
   **Built that way.** Say so if it should be workspace ADMIN only; it is one
   flag in `chat.service.js#deleteMessage`.
3. **§2.4** — workspace members not on the project cannot read the channel.
   **Built that way**, answering `404`. One line in
   `chat.service.js#requireChannel` if channels should be workspace-public.
4. **Message length cap** — 4000 characters, in `chat.validator.js`. No
   attachments in this cut; the upload module exists and a later `attachmentId`
   is additive.
5. **Notifications on mention/unread** — out of scope here. Chat writes no
   `Notification` rows in this cut; say if the bell should ring for chat.
