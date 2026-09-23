# Sprint 2 — The chat module: history, unread, mark-read

**Plan sections:** 2.1, 2.2, 2.4, 5 · **Depends on:** 1 · **Blocks:** 3

**Blocked on plan §7 questions 1 and 3** — the cursor shape and whether a
workspace member who is not on the project may read the channel. Both are
answered in the doc before the first line here is written.

## Goal

`GET /api/v1/projects/:projectId/messages` returns a page of history to a
project member and a `404` to everyone else, and the service layer that sprint 3
will call over a socket is written, mounted, and exercised over HTTP first.

## Tasks

### 2.1 The six files

- [x] `chat.dto.js` — `toMessage(row)`, a whitelist: `id`, `content`,
      `deleted`, `editedAt`, `createdAt`, `sender`. A tombstone is
      `{ deleted: true, content: null }` and the DTO is where the text is
      dropped, so no caller can forget. `sender: null` for a departed user.
- [x] `chat.validator.js` — `projectParamsSchema`, `historyQuerySchema`
      (`limit` 1–100 default 30, `cursor` opaque string), `markReadSchema`
      (`at` optional ISO). `senderId` and `userId` are `.forbidden()` in every
      schema, per plan §2.7 — a loud `VALIDATION_ERROR`, not a silent drop.
- [x] `chat.repository.js` — `findMessages`, `countUnread`, `upsertRead`,
      plus `findMessageById`, `createMessage`, `updateMessage`,
      `softDeleteMessage` for sprint 3. Prisma lives here and nowhere else.
- [x] `chat.service.js` — `listMessages`, `getUnreadCount`, `markRead`, and the
      write trio sprint 3 calls. Throws `AppError` with `AUTH_CODES`; never
      imports prisma; never touches `res`.
- [x] `chat.controller.js` — three `asyncHandler`s, each a `ApiResponse` call.
      No business logic, no `res.json()`.
- [x] `chat.routes.js` — `authGuard` → `loadProject` on all three, mounted
      under the project prefix in `src/routes/index.js`. **`requireProjectContribute`
      is deliberately NOT in the chain:** it answers `403`, and a `403` tells
      somebody with no access that the project has a conversation. The gate is
      `chat.service.js#requireChannel`, which applies the identical ladder off
      the same resolver and answers `404`. It is also what makes the REST and
      socket checks the same check rather than two that agree today.

### 2.2 The cursor

- [x] `(createdAt, id)` row-value comparison, ordered by the same pair
      descending, encoded base64 in and out. Plan §2.2.
- [x] Encode/decode live in `chat.dto.js` — the cursor is part of the response
      shape. A malformed cursor is `VALIDATION_ERROR`, never a silent first
      page: a client that thinks it is paging and is re-reading the head would
      otherwise loop forever.
- [x] `nextCursor: null` at the beginning of the channel, and specifically when
      the page came back shorter than `limit`.

### 2.3 Unread

- [x] `countUnread` — messages newer than the watermark, excluding the caller's
      own and excluding tombstones. No watermark means the whole channel.
- [x] `markRead` upserts and **never moves backwards**: `lastReadAt` takes the
      later of stored and incoming. A late request from a tab that was behind
      must not un-read what another tab already read.
- [x] A supplied `at` in the future is clamped to `now()` — otherwise one
      request marks everything unread-proof forever.

### 2.4 Failure paths

- [x] Non-member, unknown project, soft-deleted project: all `404`
      `NOT_FOUND`, identical bodies. Confirming a project exists to someone with
      no access is itself the leak.
- [x] `limit` out of range, malformed `cursor`, malformed `at`: `400`
      `VALIDATION_ERROR` with the per-field `details` array.

## Done when

- The three endpoints answer exactly the shapes in `docs/api/chat.md` §4,
  envelope included, checked against the doc rather than against the code.
- A member of project A gets `404` on project B's channel.
- Paging a channel with two messages written in the same millisecond returns
  both, once each. This is the reason the cursor changed; verify it explicitly.
- `chat.service.js` contains no `req`, no `res`, and no `prisma` import.
