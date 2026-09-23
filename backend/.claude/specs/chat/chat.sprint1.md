# Sprint 1 — Schema, one access ladder, one realtime layer

**Plan sections:** 1, 2.1–2.4, 3, 4.1, 4.2 · **Depends on:** — · **Blocks:** 2, 3

## Goal

The two tables exist. The project access ladder exists once, as a plain
function, callable with no `req`. The socket server lives in `src/realtime/`
with namespaces, and the notification bell still works exactly as it did — that
last clause is the whole risk of this sprint.

No chat behaviour ships here. Nothing a user can see changes.

## Tasks

### 1.1 Schema + migration

- [x] `Message` and `MessageRead` in `prisma/schema.prisma`, verbatim from plan
      §3 **including the comment headers** — the `SetNull`-on-sender reasoning
      and the "not a read receipt" note are the valuable part.
- [x] Reverse relations on `User` (`messages`, `messageReads`) and `Project`
      (`messages`, `messageReads`), placed beside the existing relation blocks.
- [x] Migration named `20260923100000_chat_messages`. Review the generated SQL
      before applying: the expected shape is two `CREATE TABLE`, one
      `CREATE INDEX` on `messages(projectId, createdAt)`, one `CREATE UNIQUE
      INDEX` on `message_reads(userId, projectId)`, four FKs.
- [x] `npx prisma generate`, and confirm nothing else in the diff moved.

### 1.2 `shared/services/project-access.js`

- [x] `resolveProjectAccess(userId, projectId)` → `{ project, membership,
      projectMember, projectRole, canContribute, canWrite } | null`. The body is
      `loadProject`'s, minus Express: the same `findFirst` with
      `deletedAt: null`, the same membership lookup, the same
      `ownerId`-is-authoritative rule.
- [x] `null` for every "you cannot see this" case — no project, soft-deleted,
      no workspace membership. The caller turns `null` into the `404`; the
      resolver never throws, because the socket caller has no error middleware.
- [x] `canContribute` = escalated ∨ owner ∨ any `ProjectMember` row.
      `canWrite` = escalated ∨ owner ∨ MANAGER. Same two expressions the
      middlewares compute today — computed once, here.
- [x] Comment header: one definition, two transports, and why duplicating the
      ladder into a socket handler is the failure this file prevents.

### 1.3 Middleware consolidation

- [x] `loadProject` becomes a thin wrapper: call the resolver, `404` on null,
      stamp `req.project` / `req.membership` / `req.projectMember` /
      `req.projectRole` / `req.canWriteProject`. Its comment header keeps the
      ladder documentation — that text is the reason anyone finds this file.
- [x] `requireProjectContribute` and `markProjectWriter` **move to
      `project.js`** and read the resolver's flags. Plan §1 correction 1.
- [x] ~~`task.js` re-exports both for one release~~ — **skipped.** The shim
      existed so route files could be updated later; there turned out to be
      exactly two importers (`task.routes.js`, `task-comment.routes.js`), so
      they were repointed in this sprint and the shim was never written. A
      transitional file with a one-line migration behind it is pure cost.
- [x] Every existing project/task/sprint route still passes. This task is pure
      refactor: if a response changes, the refactor is wrong.

### 1.4 `src/realtime/`

- [x] `auth.js` — the handshake middleware moved **verbatim** from
      `config/socket.js`, comment header intact. Not improved, not retyped.
- [x] `rooms.js` — `userRoom(id)`, `projectRoom(id)`. One place names a room.
- [x] `emit.js` — `emitToUser`, `emitToProject`; both no-ops when `io` is null,
      for the reason the current header gives (the email worker imports the
      notification service without ever calling `initSocket`).
- [x] `index.js` — `initSocket(httpServer)`, `getIo()`, `closeSocket()`. Builds
      the `Server`, applies `auth.js` to the root namespace **and** to `/chat`,
      keeps the join-your-own-room and disconnect-at-`exp` behaviour on root.
- [x] ~~`config/socket.js` becomes a re-export~~ — **skipped, same reason.**
      Two importers (`index.js`, `notification.service.js`), both repointed
      here; the file is deleted rather than shimmed. `email.worker.js` never
      imported it.
- [x] `server.js` — the `io` singleton, which the plan missed. `index.js` →
      `chat.namespace.js` → `emit.js` → `index.js` is an import cycle, and ESM
      resolves one by handing a caller a half-initialised module: `getIo()`
      returning undefined, intermittently, in production.

### 1.5 Contract doc corrections

- [x] `docs/api/chat.md` §1: `requireProjectContribute`'s real home, and that
      `resolveProjectAccess` is new work rather than existing code.
- [x] §4: `before=<ISO>` → the opaque `cursor` of plan §2.2, with the
      same-millisecond tie as the reason. Update the JSON example's
      `nextCursor`.
- [x] New paragraph under §1: workspace members who are not on the project
      cannot read the channel (plan §2.4), stated as a decision.

## Done when

- `npx prisma migrate status` is clean and both tables are in the database.
- Sign in, get assigned a task, and the bell still updates live — the
  notification path is untouched end to end.
- `grep -rn "requireProjectContribute" src/` shows the definition in
  `project.js` and its two importers, and nothing in `task.js`.
- No chat route is mounted and no chat event is registered. This sprint adds
  capability, not surface.
