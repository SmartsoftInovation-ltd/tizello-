# Tizello — backend

## Rules

### Documentation

- Every API module has a full contract doc at `docs/api/<module>.md`. Follow the
  [api-contract-doc skill](./.claude/skills/api-contract-doc/SKILL.md) — it
  specifies structure and depth. `docs/api/auth.md` is the reference example.
- A contract doc states the **why** behind security and behavior decisions, not
  just request/response shapes: enumeration-safety, rate-limiter choices,
  token/OTP policy, and any deliberate divergence from sibling modules.
- All shared utilities and non-trivial functions get a multi-line comment header
  describing responsibility and usage, cross-referencing the relevant skill or
  doc (e.g. `See .claude/skills/api-response/SKILL.md`).
- API responses and errors follow the
  [api-response skill](./.claude/skills/api-response/SKILL.md). Controllers never
  hand-roll `res.json()`; services throw `AppError` and the error middleware
  formats it.

### Module conventions

- Every feature module follows the
  [module-consistency skill](./.claude/skills/module-consistency/SKILL.md):
  6 files — controller, service, repository, routes, dto, validator — each with
  its fixed responsibility.
- Flow: `route → asyncHandler(controller) → controller calls service → service
  throws AppError → global error handler formats the response`. Controllers hold
  no business logic; services never touch `res`.
- `asyncHandler` wraps every async controller (no `try/catch` in controllers).
  Services throw `AppError`, never send responses.
- Global error handler rules — 4-arg signature, mounted last, `AppError` vs
  unknown-error handling, and never leaking internal/DB details — are in
  [.claude/rules/error-handling.md](./.claude/rules/error-handling.md).
- All responses go through the `ApiResponse` helper
  ([api-response skill](./.claude/skills/api-response/SKILL.md)); controllers
  never hand-roll `res.json()`.
- Multi-line comment headers on every file, cross-referencing the relevant
  skill/doc — see
  [.claude/rules/code-comments.md](./.claude/rules/code-comments.md).

### Realtime

- Socket.IO lives in `src/realtime/`: `index.js` wires the server and registers
  one namespace per feature, `auth.js` is the single handshake check, `rooms.js`
  names every room, `emit.js` is the only way other modules push to a browser.
  A feature's handlers go in their own `*.namespace.js` — never in `index.js`.
- A socket handler is a **transport**: validate the payload with the module's
  own validator, call the module's service, emit what it returns. No permission
  rule and no Prisma call in a namespace file; the project ladder is
  `shared/services/project-access.js`, which the REST middleware calls too.
- Writes persist before they broadcast, and identity comes from
  `socket.data.userId` — never from a payload. See
  [docs/api/chat.md](./docs/api/chat.md) §2–3.

### Logging

- All logging goes through the pino logger in `src/config/logger.js` —
  `createLogger('<tag>')` at module scope, `req.log` inside a request. **No
  `console.*` anywhere**, the one exception being the missing-env check in
  `src/config/env.js`, which runs before a logger can exist.
- Errors are logged as `log.error({ err }, 'message')`, never concatenated into
  the message string — the serializer is what preserves type and stack.
- Request logging (one line per request, with a request id echoed as
  `x-request-id`) is already handled by
  `src/shared/middlewares/logger.middleware.js`; handlers should not re-log it.
- Full rules, levels and redaction: [.claude/rules/logging.md](./.claude/rules/logging.md).
