# Sprint 4 — Close: shim removal, verification, doc

**Plan sections:** 4.1, 7 · **Depends on:** 3 · **Blocks:** —

## Goal

No transitional code survives the feature that needed it, and the contract doc
stops saying PROPOSED because it now describes something that runs.

## Tasks

### 4.1 Remove the shims

- [x] `index.js` and `notification.service.js` import from `src/realtime/`
      directly; `src/config/socket.js` is deleted. (`email.worker.js` never
      imported it.) Done in sprint 1 — the shim was skipped, so there was
      nothing left to remove here.
- [x] `requireProjectContribute` / `markProjectWriter` live in
      `shared/middlewares/project.js`; `task.routes.js` and
      `task-comment.routes.js` — the only importers — take them from there.
- [x] `grep -rn "config/socket" src/` returns nothing.

### 4.2 Verification, by hand, two clients

- [x] Member + non-member on the same project: the non-member gets `404` on
      history and `NOT_FOUND` on join. Verified for both a workspace member who
      is not on the project and an outsider.
- [x] Persist-before-broadcast, verified from the other side: a refused write
      (`VALIDATION_ERROR`, `FORBIDDEN`, `RATE_LIMITED`) produced `chat:error`
      and **no** `message:new` on either client. A forced database failure was
      not exercised — the ordering is structural (the namespace can only emit
      what the service returned), but that is an argument, not a test.
- [ ] **NOT VERIFIED.** Token expiry mid-conversation: the socket drops at five
      minutes, the client refreshes and reconnects, and no message sent in that
      window is lost from history. The code path is `auth.js#disconnectAtExpiry`,
      unchanged from the notification layer where it is already in production —
      but a five-minute wall-clock test was not run here, so this is inherited
      confidence rather than evidence.
- [x] Unread count and the watermark: a recipient counts an incoming message,
      the sender counts none of their own, mark-read zeroes it, and a
      backwards mark-read (`at` in 2020) does not un-read it.
- [ ] **NOT VERIFIED end to end.** Notifications still live — the bell is the
      canary for the §4.1 move. `emitToUser` and the root namespace are
      unchanged and the server boots clean, but no task was assigned across two
      browsers to watch the bell update.

### 4.3 Documentation

- [x] `docs/api/chat.md`: drop the PROPOSED banner; reconcile every divergence
      the build actually took, rather than the ones it planned to.
- [x] `.claude/plan/chat.md` gains a final section in the house pattern — what
      held, what did not, and what the next person should know — matching
      `project.md` §12.
- [x] `backend/CLAUDE.md`: one line for `src/realtime/`, since it is a new
      top-level concept and the structure list is what a newcomer reads first.

## Done when

- The repo contains no file whose comment says "for one release" — none was
  ever written.
- Two open boxes above, both honest: a five-minute token expiry and a live
  notification round-trip were reasoned about rather than observed.
- Someone who has never seen this feature can read `docs/api/chat.md` and
  implement a client against it without opening a `.js` file.
