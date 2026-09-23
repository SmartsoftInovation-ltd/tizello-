# Chat — sprint breakdown

Four sprints implementing [`.claude/plan/chat.md`](../../plan/chat.md). The plan
holds the **reasoning**; these files hold the **work**. When they disagree, the
plan wins — and gets updated to say why. The contract
[`docs/api/chat.md`](../../../docs/api/chat.md) was written first and is what
every sprint is checked against.

| Sprint | Delivers | Blocks |
|---|---|---|
| [1](./chat.sprint1.md) | schema + migration, `resolveProjectAccess`, middleware consolidation, `src/realtime/` split, doc corrections | 2, 3 |
| [2](./chat.sprint2.md) | the six-file chat module — history, unread count, mark-read | 3 |
| [3](./chat.sprint3.md) | the `/chat` namespace — join, leave, send, edit, delete, typing, presence, rate limit | 4 |
| [4](./chat.sprint4.md) | shim removal, two-client verification, contract doc out of PROPOSED | — |

**Sprint 2 is blocked on plan §7 questions 1 and 3** (cursor shape, whether
non-project workspace members may read). Sprint 1 touches neither and can start
immediately.

## Rules that apply to every sprint

Non-negotiable, from the repo's own docs. A sprint is not done if it breaks one.

- **Six files per module** — controller, service, repository, routes, dto,
  validator. No seventh, and `chat.namespace.js` is not one of them: it lives in
  `src/realtime/` because it is transport, not module.
  [module-consistency](../../skills/module-consistency/SKILL.md)
- **Controllers never call `res.json()`.** Everything through `ApiResponse`;
  status codes from `httpStatus`, never a bare integer.
  [api-response](../../skills/api-response/SKILL.md)
- **Services throw `AppError` with an `AUTH_CODES` code**, never touch `res`,
  never import `prisma`. Every async controller wrapped in `asyncHandler`, no
  `try/catch` in a controller. [error-handling](../../rules/error-handling.md)
- **No `console.*`.** `createLogger('<tag>')` at module scope, `req.log` inside
  a request, `log` inside a socket handler. [logging](../../rules/logging.md)
- **Multi-line comment header on every file**, cross-referencing the skill or
  doc it answers to. [code-comments](../../rules/code-comments.md)
- **Two rules specific to this module.** The row is written before anything is
  broadcast, and the sender is `socket.data.userId` — never a payload field.
  Plan §2.5, §2.7.
