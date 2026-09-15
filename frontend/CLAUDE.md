# Tizello — frontend

A Trello-style task management app. This package is the web client.

@AGENTS.md
@DESIGN-SYSTEM.md
@.claude/rules/workflow.md
@.claude/rules/ui-components.md
@.claude/rules/pages-and-structure.md

## Build progress

> Keep this current — check items off as they ship.

What is actually in `src/`, not what is planned. Everything here is
frontend-only and fixture-backed: a checked box means the UI exists and works
against demo data in `src/lib/`, never that a backend is wired.

- [x] **Design system + theming** — tokens in `globals.css`, every colour a
      `light-dark()` pair, `ThemeToggle`. The reference page still occupies `/`.
- [x] **Auth** — sign-in (email → password or code), sign-up, forgot/reset
      password, verify email, sign-out. Server Actions over `auth-fixtures.ts`;
      `proxy.ts` does the optimistic cookie check.
- [x] **Workspace** — full CRUD against the real API (`lib/workspaces.ts` →
      `backend/docs/api/workspace.md`), no fixtures left in the path.
      `/workspaces` draws the list two ways from `?view=grid|list` — the card
      grid and a table with role, status and both dates — with `?archived=1`
      as the way back to anything archived. `/workspaces/[workspaceId]` is a
      real detail page: identity header, a `<dl>` of the stored record, an
      archived banner, and the projects grid still fixture-shaped beneath it.
      Edit (name / description / icon / colour, changed fields only), archive
      and restore (`isArchived`), and delete (`deletedAt` — soft on the server,
      permanent from here) all hang off one `WorkspaceActionsMenu`, gated by
      `canUpdateWorkspace` / `canDeleteWorkspace` in `lib/roles.ts` — a mirror
      of the API's permission table, drawing controls only; the API enforces.
      Switching is two controls over the same list: the sidebar's
      `WorkspaceSwitcher` and the detail page's `WorkspaceSwitchMenu`, both
      real `<a>`s. Every screen under `/workspaces/[workspaceId]` now resolves
      its workspace from the API, so the ids in a switcher are the ids those
      pages accept; only their members / projects / sprint data is still
      fixture-backed.
- [x] **Members** — full CRUD against the real API (`lib/members.ts` →
      `backend/docs/api/member.md`, `lib/invites.ts` →
      `backend/docs/api/invitation.md`), no fixtures left in the path.
      `/workspaces/[workspaceId]/members` reads the real roster
      (`GET .../members`, owner first, names falling back to the address's local
      part for an account that never set one) and the real pending invitations,
      over two tabs whose counts come from the two lists. Role change
      (`PATCH .../members/:memberId`) is optimistic and rolls back on failure;
      remove (`DELETE .../members/:memberId`) waits for the server, because its
      `409` — a member who still owns projects — names those projects in the
      toast. Both live in `use-member-mutations.ts` and go through
      `lib/actions/member-actions.ts`, which revalidates this route *and* the
      permissions screen. Invite, cancel and resend were already real; so is the
      accept page at `/invite/[token]`. Controls are gated by
      `canChangeMemberRole` / `canRemoveMember` in `lib/roles.ts` — a mirror of
      the API's permission table, so role change draws live only for an OWNER
      and remove for OWNER/ADMIN — plus a per-row lock with its own sentence for
      the owner's row and your own row. There is deliberately no "add member":
      the only way in is an invitation the recipient accepts.
- [ ] **Projects** — `/workspaces/[workspaceId]/projects` renders five
      URL-driven views (`?view=active|timeline|board|all|status`) over
      `demo-projects.ts`, plus the grid and create dialog on the workspace page.
      The sidebar's Projects item is a disclosure over those same five URLs —
      chevron toggle, the five views as children, and locked `+` / `⋯` row
      actions. **Board drag & drop works** — `@dnd-kit/react`, pointer and
      keyboard, and a drop into another column is a `PATCH /projects/:id` with
      the new status. Only the COLUMN persists: `Project` has no rank field, so
      the order a card is dropped at holds for the session and the server's
      order returns on reload (`lib/project-board-order.ts`). Filter, sort and
      search in the toolbar are still `LockedControl`s. `Project` (workspace
      tile) and `ProjectRecord` (full record) are still two types.
- [x] **Backlog** — `/board/backlog` (the sidebar's link; `?project=` picks the
      project, defaulting to the first one) and
      `/workspaces/[workspaceId]/projects/[projectId]/backlog` both render
      `components/tasks/project-backlog.tsx` — real data (`lib/tasks.ts`,
      `lib/task-bulk.ts`, `lib/task-history.ts` → `backend/docs/api/task.md`).
      **Not-started work only** — the TODO-group statuses, empty ones included
      as drop targets; a task moved into IN_PROGRESS or COMPLETE drops off.
      **Ranked:** rows are in `position` order and drag (grip, pointer or
      keyboard) reorders within a status or into another one — one
      `PATCH /tasks/:id/move` naming the new neighbours (`lib/task-rank.ts`);
      the server does the arithmetic. **Search + filters** (type, priority,
      assignee incl. "me"/unassigned, tag) run client-side over the whole list
      (`lib/task-filters.ts`). **Quick add** under every status (title + Enter,
      stays open). **Bulk:** a checkbox per row, "Select all N", and a sticky bar
      to set status / priority / assignee / type or delete the selection — one
      all-or-nothing request. Sub-tasks live under their parent. The drawer
      (`task-drawer.tsx`, same `project-surface` preference as projects):
      type mark + title, "Created by … on …", Status / Assignee / Due, then
      Type, Priority, Story points, Tags, Description, Files & media, custom
      columns ("+ Add a property", writers only), Relations (parent picker +
      sub-tasks), Comments (author can edit; "(edited)" shown) and a collapsed
      Activity log (`GET /tasks/:id/activity`). ID, Icon, Colour and Delay
      rows were removed on purpose — see `task-builtin-rows.tsx`. Fields
      ride Save as a changed-fields-only PATCH; sub-tasks and comments write
      immediately. Collaborators may edit tasks (`lib/task-roles.ts`); columns
      stay with project writers. **Tasks planned into a sprint leave this list**
      (they live on sprint planning until the sprint returns them). Story points
      are Fibonacci buttons in the drawer and a picker on each row; the drawer
      also has a Sprint field. The sprint-board screen is still on fixtures.
- [ ] **Sprint** — `/workspaces/[workspaceId]/projects/[projectId]/sprints`
      lists five fixture sprints from `demo-sprints.ts`, grouped Active /
      Planning / Completed, with a create-and-edit dialog (`TextField
      type="date"` is the date input), start / complete confirms and
      delete-with-confirm. All `useState`: nothing persists past a refresh.
      `Sprint` (board stamp) and `SprintRecord` (full record) are two types.
- [x] **Sprint planning** — `/board/sprint-planning` (the sidebar's link, same
      `?project=` picker as the backlog, `components/tasks/board-project-selection.ts`)
      and `/workspaces/[workspaceId]/projects/[projectId]/sprint-planning` both
      render `components/sprint-planning/project-sprint-planning.tsx` — real data
      (`lib/sprints.ts` → `backend/docs/api/sprint.md`). **Jira-style:** every
      open sprint as a box (active first, then planning), stacked above a
      Backlog box; **drag & drop** a task into a sprint, back to the backlog,
      between sprints or to a new rank — one `PATCH /tasks/:id/move` with
      `sprintId` + neighbours (`use-planning-dnd.ts`, optimistic). Each sprint
      header shows dates, task count, To do / In progress / Done points and
      capacity, with **Create / Edit / Start / Complete / Delete sprint**
      (project writers). Start sets dates with 1–4 week buttons; one active
      sprint per project (Start is disabled with the reason). Complete keeps
      done tasks and returns the rest to the backlog. Rows carry the status chip
      and a **story-points picker** (1 · 2 · 3 · 5 · 8 · 13); quick add per box.
      **Same surfaces as the backlog** (`planning-overlays.tsx`): toolbar with
      Statuses / Create sprint / New task, the task drawer (view, edit, create —
      seeded into a sprint from its ⋯ → "Add task to this sprint"), delete
      confirm, status editor, bulk bar (incl. "Sprint"). A row's ⋯ menu adds
      **Move to** (any open sprint, backlog, top/bottom) as the click twin of a
      drag. A sprint opens in the same drawer (side panel or centred), with a
      summary bar of done / in-progress / to-do points; "No sprints yet" card
      when empty. Sub-tasks follow their parent into a sprint.
- [x] **Columns** — To do / In progress / Done, fixed on sprint boards, rendered
      by `BoardColumn` + `ColumnPill`. A card's column is its status.
      `BoardColumn` is the shell both boards share: pill, count, track, empty
      state and a `footer` slot for the composer, plus optional droppable
      wiring (`containerRef` / `isOver`) that the sprint board fills in.
- [x] **Sprint board + tasks** — `/board/sprint` renders the one ACTIVE sprint
      (SPR-13) from `demo-board.ts`: header with project, sprint, window and
      state badge; live done/total and points on the toolbar; three columns of
      task cards with id, priority, labels, points and assignee. **Drag & drop
      works** — `@dnd-kit/core` + `@dnd-kit/sortable`, pointer and keyboard,
      reorder within a column and move between them (which changes status),
      `DragOverlay` ghost and a dashed drop indicator on the landing column.
      A drop writes one float `position` (`lib/sprint-board.ts`), never a
      renumber. Detail dialog edits every field including the column, with
      empty-title validation and delete-with-confirm; a title-only quick add
      sits under each column. Filter / sort / search are `LockedControl`s and
      "Complete sprint" opens a confirm that changes nothing — `closeSprint` in
      `lib/sprint.ts` is still uncalled. All `useState`: nothing persists past
      a refresh.
- [ ] **Permissions** — `/workspaces/[workspaceId]/settings/permissions` renders
      the three role cards, a read-only permissions matrix (14 actions in four
      areas × OWNER / ADMIN / MEMBER, from `demo-permissions.ts`) and a role
      assignment list over the **real** roster. **The two halves of this screen
      no longer have the same status**, which is the thing to know before
      touching it: defining a role — create, edit, delete, every matrix cell —
      is still `useState` over fixtures, because the API has exactly three roles
      and no endpoint for a fourth, while assigning one of those three to a
      member is a real `PATCH .../members/:memberId` through the same action the
      members screen uses (`use-role-assignment.ts`). So a renamed role card is
      gone on refresh and a changed member role is not. Assigning a *custom*
      role is refused with a sentence rather than written, and the selects are
      gated by `canChangeMemberRole` like the members screen. The matrix is
      still what the screen DRAWS, never what anything enforces.

## Stack

| Concern    | Choice                                        |
| ---------- | --------------------------------------------- |
| Framework  | Next.js 16 (App Router, Turbopack, `src/`)    |
| Language   | TypeScript (strict)                           |
| Styling    | Tailwind CSS v4 — CSS-first config, no `tailwind.config.js` |
| Font       | Inter, via `next/font/google`                 |
| Drag & drop| **Two, on purpose.** Hand-rolled (projects board) · `@dnd-kit/core` + `@dnd-kit/sortable` (sprint board) — see below |
| Alias      | `@/*` → `src/*`                               |

```bash
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

### Why two drag-and-drop implementations

**The projects board (`?view=board`) is hand-rolled.** It was on
`@dnd-kit/react` and that is what caused its worst bug: the library's sortable
is CONTROLLED, so the column map had to be mutated on every `dragover`. The
list reordered under the pointer, each reorder re-measured, and a re-measure
could resolve to a different target than the one that produced it — the cards
in the hovered column shuffled continuously for as long as a card was held.
Four attempts at damping that loop each removed one feeder and left the loop
standing, because the loop was the architecture.

The replacement inverts the rule: **nothing moves in the layout until the
drop.** Boxes are measured once at the press; every frame after resolves a
target against those frozen numbers and expresses it as `transform` only, which
composites and reflows nothing. State is written once, on release. A feedback
loop needs feedback, and there is none.

| File | Role |
| --- | --- |
| `src/lib/board-drag.ts` | pure geometry — snapshot types, `resolveTarget`, `cardOffsets` |
| `src/components/projects/use-project-board-dnd.ts` | the pointer: measure, listen, move the carried card |
| `src/lib/project-board-order.ts` | the column map, and `place()` — what a drop commits |
| `src/components/projects/use-board-pan.ts` | grab the background, pan the rail |

**The sprint board is still on `@dnd-kit/core` + `@dnd-kit/sortable`** and
works. It is a different gesture over a different model — three fixed columns
with a real `position` field to persist — and it does not have the projects
board's problem. Leave it alone; migrating it is its own job.

**Do not add a drag-and-drop library to the projects board again.** If the
hand-rolled version needs a feature it lacks (auto-scroll at the rail's edges,
multi-select), add it to the files above.

## Design system

Tokens were extracted from trello.com and reduced to a minimal set. They live in
`src/app/globals.css` as Tailwind v4 `@theme` blocks.

**Full reference: [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md)** — palette, type scale,
radii, elevation, the brand contrast rule, and the house rules for using them.
It is imported above, so it is always in context. Read it before writing any
markup.

Three things it is easy to get wrong:

- **Use the semantic layer, not the ramps** — `bg-surface`, not `bg-ink-0`.
  Ramp utilities are frozen in the light palette and break dark mode.
- **`brand-500` carries dark ink, never white** — `bg-brand-500 text-on-brand`.
- **Never interpolate a class name** — `` `bg-brand-${step}` `` won't exist.

## Light and dark mode

Both ship. The theme is `data-theme` on `<html>` — absent means follow the OS,
`"light"` and `"dark"` force it. Every themed colour is a single `light-dark()`
declaration in `globals.css`, so the two attribute rules re-resolve the whole
palette; there is no duplicated dark block.

| File | Role |
| --- | --- |
| `src/app/globals.css` | the `light-dark()` token values (block 3) |
| `src/lib/theme.ts` | `Theme` type, the `tizello-theme` cookie, `themeFromCookies` |
| `src/components/ui/theme-toggle.tsx` | Light / Dark / System control |
| `src/app/layout.tsx` | reads the cookie, stamps `data-theme` on `<html>` |

**Write markup once.** If a component needs a `dark:` utility, a semantic token
is usually missing — add the token instead. Full mechanics, both neutral ramps,
and the hydration constraints are in
[DESIGN-SYSTEM.md § Themes](./DESIGN-SYSTEM.md#themes).

To check work: open `/` and flip the toggle. Anything that doesn't re-theme is
reaching past the semantic layer.

`/` currently renders the design-system reference page. Delete it once the real
board UI lands.

## Rules

Four rule files are imported above, so they are always in context. They are the
contract for this package — read them before writing code, not after review.

| File | Covers |
| --- | --- |
| [.claude/rules/workflow.md](./.claude/rules/workflow.md) | backlog → sprint planning → sprint board → close |
| [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md) | tokens, palette, type scale, themes |
| [.claude/rules/ui-components.md](./.claude/rules/ui-components.md) | server/client split, images, the 150-line cap, a11y |
| [.claude/rules/pages-and-structure.md](./.claude/rules/pages-and-structure.md) | file structure, new-page checklist, data fetching |

The four that get broken most often:

1. **Server Components by default.** `"use client"` marks a *boundary* — the
   file and everything it imports ships to the browser. One interactive button
   on a page means a client leaf in its own file, not a client page.
2. **Images go through `AppImage`** (`@/components/ui/app-image`) — quality 100,
   lazy, fallback on error. A raw `<img>` fails lint.
3. **150 lines per component**, enforced by `max-lines` in `eslint.config.mjs`.
4. **Semantic tokens only** — `bg-surface`, never `bg-ink-0`, or dark mode breaks.

`npm run lint` enforces 2–3. The rest is on review.

## Structure

```
src/
  app/            # routing ONLY — page/layout/loading/error + globals.css
  components/
    ui/           # generic primitives (app-image, theme-toggle)
    board/        # feature components (columns, cards, composer)
    layout/       # app shell
  lib/            # data access, helpers, pure logic
    actions/      # Server Actions — the one place lib/ may import next/*
  types/          # shared domain types
```

Routes so far: `/` design-system reference · `/board/[boardId]` the board —
`/board/sprint` is the sprint board, `/board/backlog` the flat one.
