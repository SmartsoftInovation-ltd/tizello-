# `role` — API contract

**Module:** `src/modules/role/` · **Route prefix:**
`/api/v1/workspaces/:workspaceId/roles`

> **Sibling-contract check.** Response envelope, `AppError` shape,
> validation-error shape, guard middleware names and rate-limiter precedent all
> match [member.md](./member.md), [workspace.md](./workspace.md) and
> [auth.md](./auth.md): `{ success, statusCode, message, data }` from
> `ApiResponse`, services throwing `AppError` carrying a `data.code` from
> `AUTH_CODES`, `validate` producing `400` with a per-field `details` array, and
> `authGuard` → `validate(params)` → `loadMembership` → `requirePermission` →
> `validate(body)` from `shared/middlewares/`.
>
> **Deliberate divergences, three of them:**
>
> 1. **Reads are gated on `members.view`, not `roles.manage`.** Every other
>    module gates a resource's read on a permission named after that resource.
>    Here, anyone who can see the roster can see what the roles mean: a
>    workspace where only admins may read the permission grid is one where
>    nobody else can find out *why* an action was refused. Writing a role is
>    the privileged half.
> 2. **The built-in rows are seeded lazily, on first read, not by the
>    migration.** `20260921120000_workspace_roles` creates the table empty.
>    `listRoles` seeds Owner/Admin/Member from `ROLE_PERMISSIONS` in
>    `shared/constants/roles.js` when it finds none. That keeps ONE definition
>    of what Owner means — the same table `permissionsFor` falls back to —
>    instead of a copy in SQL that drifts the first time a permission is added.
>    It also means no backfill has to touch every existing workspace before the
>    screen works.
> 3. **`DELETE` answers `200` with a body, not `204`.** Every other write on
>    this module returns the affected role, and one endpoint answering
>    differently is a branch every caller has to remember. The body is
>    `{ id }` — enough to drop it from a list.

---

## 1. The permission catalog

`PERMISSION_CATALOG` in `shared/constants/roles.js` is the single list of
things a role can be granted. It is **served** (§2) rather than duplicated in
the client, and that is the design: `requirePermission` gates on these exact
ids, so a switch drawn from the same list cannot claim a power the server does
not check.

| Area | Permission | Enforced by |
|---|---|---|
| workspace | `workspace.view` | `GET /workspaces/:id` |
| workspace | `workspace.edit` | `PATCH /workspaces/:id`, `/archive` |
| workspace | `workspace.delete` | `DELETE /workspaces/:id` |
| members | `members.view` | the roster read, and every read in this module |
| members | `members.invite` | `POST .../invitations` |
| members | `members.remove` | `DELETE .../members/:memberId` |
| members | `members.roles` | `PATCH .../members/:memberId` |
| projects | `projects.view` | the project list |
| projects | `projects.create` | `POST .../projects` |
| projects | `projects.manage` | the workspace-admin escape hatch — `project.js`, `task.js`, `trash.service.js` |
| roles | `roles.manage` | every write in this module |

**Every row is enforced somewhere, and a test pins it.** The catalog is served
to the browser and drawn as a grid of switches, so a row nothing checks is a
control that lies. `roles.custom.test.js` walks `src/` for `PERMISSIONS.X`
references and fails on any catalog id with none — in both directions, since a
permission declared but *missing* from the catalog is one no role can be
granted, making every endpoint behind it unreachable to all but an OWNER.

Two rows failed that check when it was written. `workspace.billing` was
declared, granted to OWNER and read by nothing — the schema carries
`plan`/`seatLimit` columns for a feature that does not exist — so it was
removed until there is something to gate. `workspace.view` was in the same
state: `GET /workspaces/:id` had `loadMembership` and no permission check, so
membership alone silently answered the question the grid claimed to ask. That
route now requires it.

**Tasks are deliberately absent.** Who may touch a task is decided by the
PROJECT role ladder (`ProjectRole` in the schema, `shared/middlewares/task.js`);
a workspace role only opens the door through `projects.manage`. Rows here for
"create task" or "move task" would be switches that gate nothing, which is
worse than not offering them.

**What the sprint board, backlog and trash are gated by, since they have no
rows here.** Every write on a task or a sprint funnels through the PROJECT
ladder in `shared/middlewares/project.js` and `task.js`: the project's owner, a
project `MANAGER`, or a workspace role holding `projects.manage`. Trash is the
same ladder, resolved per row in `trash.service.js`. So a workspace role grants
board access exactly one way — `projects.manage`, which grants it for *every*
project — and finer access is a `ProjectMember` row, which is the project's own
members screen rather than this one.

**The ids changed shape in this release** — `workspace:update` became
`workspace.edit`, and so on for all eleven. They are product-facing now because
they are shipped to the browser and ticked by a person; the dotted form is what
the roles screen already used. Nothing persisted the old strings, so there is no
migration: `ROLE_PERMISSIONS` is rebuilt from the constants at boot.

## 2. `GET /workspaces/:workspaceId/roles/permissions`

The catalog, grouped for display. `200` with
`{ groups: [{ area, label, actions: [{ id, label }] }] }`.

Requires `members.view`. Mounted **before** `GET /` so `/permissions` is not
captured by a `:roleId` param — declaring it second would make the catalog
unreachable and answer `404 Role not found` for it.

## 3. `GET /workspaces/:workspaceId/roles`

Every role in the workspace, built-ins first, then by tier, then by name.
`200` with `{ roles: [...] }`.

```json
{
  "id": "cmuatpjy20000vfj28ba2x2s7",
  "name": "Reviewer",
  "baseRole": "MEMBER",
  "builtIn": false,
  "permissions": ["workspace.view", "projects.view", "projects.manage"],
  "memberCount": 3,
  "createdAt": "2026-09-21T05:47:23.066Z",
  "updatedAt": "2026-09-21T05:47:23.066Z"
}
```

`permissions` is filtered against the catalog **on the way out as well as in**
(`role.dto.js`). A row written before a permission was retired still holds the
dead id, and shipping it would draw a grid column the server no longer gates on.

Seeds the three built-ins if the workspace has none — see divergence 2.

## 4. `POST /workspaces/:workspaceId/roles`

Requires `roles.manage`. `201` with `{ role }`.

```json
{ "name": "Reviewer", "baseRole": "MEMBER", "permissions": ["projects.view"] }
```

| Rule | Answer |
|---|---|
| `name` 2–40 chars, trimmed | `400 VALIDATION_ERROR` |
| `baseRole` is `ADMIN` or `MEMBER` | `400 VALIDATION_ERROR` |
| every `permissions` id is in the catalog | `400 VALIDATION_ERROR` |
| the name is already used in this workspace | `409 CONFLICT` |
| a permission the AUTHOR does not hold | `403 FORBIDDEN` |

### Why `baseRole` exists, and why it cannot be `OWNER`

`roleAtLeast(role, ADMIN)` walks `MEMBER < ADMIN < OWNER`, and "Reviewer" is not
on that ladder by name. So every role declares which rung it sits on, and
assigning it writes that rung to `Membership.role` alongside `Membership.roleId`.
The grant comes from the role; the ladder comes from the rung.

`OWNER` is omitted from the validator's list rather than rejected by a rule — a
closed list cannot be widened by a typo. A workspace able to mint a role on the
OWNER rung could mint one for anybody, and that rung gates ownership transfer
and workspace deletion.

### Why a role cannot grant what its author lacks

`resolveGrant` in `role.service.js` refuses outright rather than silently
narrowing. Without it: an ADMIN holds `roles.manage`, writes a role granting
`workspace.delete`, has an owner assign it — or assigns it themselves if they
also hold `members.roles` — and has escalated past the owner. The ceiling is the
**author's own resolved grant**, not the new role's base tier, so an admin
cannot hand out more than they hold even to a role they place above themselves.

Refusing rather than narrowing is deliberate: a request naming a permission
above the ceiling is a client that has drifted from the catalog, and saving
less than was asked for would leave a grid on screen that disagrees with the row.

## 5. `PATCH /workspaces/:workspaceId/roles/:roleId`

Requires `roles.manage`. `200` with `{ role }`. Every field optional, at least
one required (`.min(1)`) — a `PATCH` with an empty body is a client bug, and
answering `200` to it hides the bug.

| Rule | Answer |
|---|---|
| unknown role, or one in another workspace | `404 NOT_FOUND` |
| `builtIn: true` | `403 FORBIDDEN` |
| name clashes with another role | `409 CONFLICT` |
| a permission the author does not hold | `403 FORBIDDEN` |

A built-in is a record of what the application code means, not a row to edit.
`assertEditable` is the one guard; there is no partial "you may rename it but
not re-scope it" state, because a renamed Owner is just as misleading as a
re-scoped one.

## 6. `DELETE /workspaces/:workspaceId/roles/:roleId`

Requires `roles.manage`. `200` with `{ id }`.

| Rule | Answer |
|---|---|
| unknown role | `404 NOT_FOUND` |
| `builtIn: true` | `403 FORBIDDEN` |
| anyone still holds it | `409 CONFLICT`, `details: { memberCount }` |

`Membership.roleId` is `ON DELETE SET NULL`, so deleting a role in use would not
delete anybody — it would silently drop every holder back to their tier's
default grant, which is a real change in what those people can do. It is refused
while anyone holds it, and the `409` names the count so the client can say
"reassign 3 members first" rather than "something went wrong".

## 7. Assignment lives in the member module

`PATCH /workspaces/:workspaceId/members/:memberId` — see
[member.md](./member.md). It now takes **exactly one of** `role` or `roleId`
(Joi `.xor`):

- `{ role: "ADMIN" }` — sets the tier and **clears** any custom role. This is
  how "back to the plain tier" is expressed.
- `{ roleId: "cmu…" }` — assigns that role; the server writes
  `Membership.role = role.baseRole` from it.

`.xor` rather than two optionals so there is no precedence rule to remember, and
so "change this member to nothing" cannot be expressed.

Assigning is gated on `members.roles`, which is **OWNER only**, while defining a
role is `roles.manage`, which is OWNER and ADMIN. The gap is deliberate:
authoring alone escalates nothing (§4), authoring plus assigning is how an admin
would mint themselves a peer.

## 8. Resolution — what a membership actually holds

`permissionsFor(membership)` in `shared/constants/roles.js`, called by
`membershipCan`, which is what every guard now uses:

1. No membership → `[]`.
2. `role === OWNER` → the whole catalog, **always**. A custom role on the owner
   cannot take away `workspace.delete` and lock the last person with authority
   out of their own workspace — the only recovery from which is direct database
   access. Ownership is an identity; the grid describes capabilities.
3. A custom role with an array of permissions → that array, filtered to the
   catalog and returned in catalog order.
4. Otherwise → `ROLE_PERMISSIONS[tier]`, which is every membership that existed
   before this feature.

`loadMembership` includes `customRole` on the membership it resolves, so the
whole decision is one query. `trash.repository.js#membershipFor` does the same —
a membership read without it silently falls back to the tier and disagrees with
the endpoint that enforces.

## 9. Caching

Nothing here is cached. A role read is an authorization input, and a stale hit
means a revoked permission still answering — the same rule
[auth.md](./auth.md) §Caching states for the session.
