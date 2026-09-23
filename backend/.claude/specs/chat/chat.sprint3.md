# Sprint 3 — The `/chat` namespace

**Plan sections:** 2.3, 2.5, 2.6, 2.7, 4.1, 4.3 · **Depends on:** 1, 2 · **Blocks:** 4

## Goal

Two browsers in the same project see each other's messages, edits, deletions,
typing and presence. Every write goes through sprint 2's service, so there is
one implementation of every permission rule and one place a row is written.

## Tasks

### 3.1 `src/realtime/chat.namespace.js`

- [x] Registered on `/chat` by `realtime/index.js`, sharing `auth.js`. Per plan
      §4.1: a namespace, not more rooms on `/`.
- [x] Every handler is the same four lines — validate the payload, resolve
      access, call `chat.service`, emit. Nothing is awaited before the
      listeners are registered: Socket.IO drops an event that arrives before
      its listener exists, and every client emits `channel:join` on connect. A handler with an `if (role === …)` in
      it is a bug; that check belongs to `resolveProjectAccess`.
- [x] Socket-side validation reuses `chat.validator.js`'s schemas. One
      vocabulary of valid input across both transports.

### 3.2 Events

- [x] `channel:join` — `resolveProjectAccess`, `canContribute` or `chat:error`
      **`NOT_FOUND`** (not `FORBIDDEN`, as this spec first said — the socket
      answers exactly what the REST half answers, and `FORBIDDEN` would confirm
      the channel exists); joins `projectRoom(projectId)`. A socket may hold
      several.
- [x] `channel:leave` — leaves the room; no permission check needed to stop
      listening.
- [x] `message:send` — **membership re-checked here, not trusted from join**
      (plan §2.6); service writes the row; **then** `message:new` to the room
      with the DTO plus the echoed `clientId`. If the write throws, nothing is
      broadcast and the sender gets `chat:error`.
- [x] `message:edit` — author only, no escape hatch (plan §2.3). Sets
      `editedAt`, broadcasts `message:edited`. Editing a deleted message is
      `NOT_FOUND`, not a resurrection.
- [x] `message:delete` — author, or `canWrite`. Soft delete; broadcasts
      `message:deleted` with the id so clients drop the bubble.
- [x] `typing:start` / `typing:stop` — `socket.to(room)`, so never echoed to
      the sender. Not persisted. A server-side timer emits `typing: false`
      automatically if no stop arrives: a client that crashes mid-keystroke
      must not leave "Alice is typing" on screen forever.
- [x] `presence:list` — derived from the room's sockets, deduplicated by user
      (three tabs are one person). Nothing is stored: presence that outlives the
      connection is a ghost waiting for a cleanup job nobody wrote.
- [x] `chat:error` — `{ event, code, message }`, `code` from `AUTH_CODES`.
      Never a thrown exception, never a silent drop. The table in
      `docs/api/chat.md` §3 is the contract.

### 3.3 Rate limiting

- [x] Per-connection token bucket in the namespace: 20 messages / 10s, typing
      5 / 10s. Plan §4.3.
- [x] Over the bucket is `chat:error` `RATE_LIMITED`, **not** a disconnect — a
      burst is far more often a fast typist than an attack.
- [x] State lives on `socket.data` and dies with the connection. No map keyed by
      user id that nothing ever cleans up.

### 3.4 Sender identity

- [x] Every write takes `socket.data.userId`. Grep the finished namespace for
      `payload.senderId` / `payload.userId` and confirm zero hits — plan §2.7,
      and the single most important line in the contract.

## Done when

- Two browsers, same project: send, edit, delete, typing and presence all
  arrive live, and the sender's optimistic bubble reconciles via `clientId`
  rather than rendering twice.
- A socket that joined a channel and is then removed from the project gets
  `FORBIDDEN` on its **next send**, without reconnecting.
- Killing the database mid-send produces `chat:error` and **no** `message:new`
  in either browser. This is the rule the module exists for; test it
  deliberately rather than assuming it.
- A message sent over the socket appears in the REST history page unchanged —
  same DTO, same shape, one service.
