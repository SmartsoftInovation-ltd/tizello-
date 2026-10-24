# Tizello Calendar — plan

Status: **proposal**, nothing built. The sidebar already carries a
"Tizello Calendar · Soon" row under *Tizello Apps*; this is what fills it.

---

## 1. What problem it solves

Tizello already stores dates in three places, and no screen shows them together:

| Record | Dates it has | Where you can see them today |
| --- | --- | --- |
| `Task` | `dueDate`, `completedAt` | My tasks (bucketed: Overdue / Today / 7 days / Later), one project's backlog |
| `Sprint` | `startDate`, `endDate`, `startedAt`, `completedAt` | sprint planning, sprint board header, one project at a time |
| `Project` | `startDate`, `endDate` | projects `?view=timeline` |

Each of these answers a question about **one thing**. Nothing answers the
questions that are about **time**:

- **"What is due on Thursday?"** across every project I am in.
- **"Is the week of the release overloaded?"** Five tasks due the same day
  only shows up when the days are laid out side by side.
- **"Does this deadline land after the sprint ends?"** A task due on the 20th
  in a sprint that closes on the 17th is a planning mistake, and it can only
  be seen when the due date and the sprint window are on the same axis.
- **"When is my team busy?"** A lead planning the next sprint needs to see
  the deadlines already committed, not a backlog sorted by rank.

My tasks gives you a **to-do list** (what is next). The backlog gives you a
**priority order** (what matters most). The calendar gives you a **schedule**
(what happens when). Without one, people keep deadlines in their heads, or in
Google Calendar by hand, and the two drift apart.

**Who it is for:**

| Person | Uses it to |
| --- | --- |
| Member | plan their week; see due dates without opening six projects |
| Lead / admin | spot pile-ups, check due dates fit the sprint, plan the next sprint around them |
| Owner | see project and sprint windows across the workspace at a glance |

**What it is not:** it is not a meeting scheduler, and it is not a Google
Calendar replacement. It shows **work** on a time axis. (Events are an
explicit later phase, §6, and only if the earlier phases prove it is wanted.)

---

## 2. Scope by phase

Each phase ships on its own and is useful without the next one.

### Phase 1 — Read-only calendar (the MVP)

- Route **`/calendar`** under the app shell. The sidebar row stops saying "Soon".
- **Month view** (6×7 grid) and **week view** (7 columns, all-day lanes), plus an
  **agenda view** (a list grouped by day), which is also the mobile layout and
  the accessible twin, the same role the table plays under the sprint
  breakdown charts.
- Shows:
  - **Tasks** on their `dueDate`: key, title, a status-group dot, an
    assignee initial. Completed ones are dimmed, and overdue open ones are
    marked in `danger`.
  - **Sprints** as a bar spanning `startDate` → `endDate`.
  - **Projects** as a bar spanning `startDate` → `endDate` (week/month only,
    collapsible lane, since they are long).
- Filters (all URL params, like `/my-tasks` and the breakdown, so the screen
  can stay a **Server Component with no client JS**):
  - `?scope=mine|workspace`: assigned to me (default) vs everything in the
    active workspace
  - `?view=month|week|agenda` · `?date=2026-10-24` (the anchor day)
  - `?project=` (optional, narrows to one project)
  - `?show=tasks,sprints,projects` (which layers to draw)
- Clicking a task links to the board it lives on (same rule as search: the
  sprint board if it is in a sprint, the backlog if not).
- "+N more" in a crowded month cell links to that day in agenda view.

### Phase 2 — Interactive

- **Drag a task to another day** to change its `dueDate`. One `PATCH /tasks/:id`
  with the new date, optimistic, rolled back on failure. A client leaf over
  the server grid; use `@dnd-kit/core` (already a dependency for the sprint
  board), **not** the projects board's hand-rolled engine, since this is a grid of
  fixed cells, not a reflowing list.
- **Click an empty day** to quick-add a task with that due date (pick project).
- **Open the task drawer in place** (`?task=` deep link), reusing
  `task-drawer.tsx`, the same surface as the backlog. This also closes the
  "search hit doesn't open the drawer" gap noted in CLAUDE.md.
- **Warnings** drawn on the grid:
  - a task due **after its sprint's `endDate`**
  - a day where one person has **more than N points / tasks due** (N from
    workspace settings, default 3 tasks)
- Who may drag: anyone who may edit the task (`lib/task-roles.ts`);
  read-only otherwise, with the usual `LockedControl` reason.

### Phase 3 — Task date ranges

- Add **`Task.startDate`** (nullable). Today a task only has an end, which is
  why the sprint breakdown gantt has to run from `createdAt` and call it "a
  window, not a schedule". With a start, a task can draw as a bar across days.
- Resize a task bar's edges in week view to set start/due.
- The sprint breakdown gantt switches to `startDate ?? createdAt`.
- Schema change + migration; the drawer gets a "Start" row beside "Due".

### Phase 4 — Out to other calendars (ICS feed)

- **Subscribe in Google Calendar / Outlook / Apple Calendar** through a
  read-only, per-user iCalendar feed: `GET /calendar/feed/:token.ics`.
- The token is a random per-user secret (rotatable from profile), because a
  calendar app can't send our cookies. The feed holds only what the user could
  see in-app, scope `mine`.
- This is cheap (one endpoint, no OAuth) and covers most "sync with Google" asks.
  **Two-way Google sync is not planned.** It means OAuth scopes, webhooks
  and conflict rules, and few teams need it once the feed exists.

### Phase 5 — Events (only if asked for)

- A `CalendarEvent` model for things that are not tasks: sprint ceremonies
  (planning, review, retro), releases, holidays/leave.
- Leave matters more than meetings. "Rafi is off 3–7 Nov" changes how much work
  should land in that sprint, and feeds the capacity warnings from phase 2.
- Decide after phases 1–2 are in use. Don't build it speculatively.

---

## 3. Backend (phase 1)

New module `backend/src/modules/calendar/`, the usual six files (controller,
service, repository, routes, dto, validator), contract at
`backend/docs/api/calendar.md`.

### `GET /calendar`

| Query | Rule |
| --- | --- |
| `from`, `to` | ISO dates, required. **`to − from` ≤ 62 days**: a month grid with padding is 42 days; the cap stops a "give me 10 years" scan |
| `scope` | `mine` (default) or `workspace` |
| `workspaceId` | required when `scope=workspace`; checked with `loadMembership` |
| `projectId` | optional narrowing; must belong to a workspace the caller is in |
| `include` | `tasks,sprints,projects` subset, default all |

Response:

```json
{
  "tasks":    [{ "id", "key", "title", "dueDate", "statusGroup", "statusColor",
                 "projectId", "projectName", "sprintId", "assignees": [...], "completedAt" }],
  "sprints":  [{ "id", "name", "projectId", "startDate", "endDate", "state" }],
  "projects": [{ "id", "name", "color", "startDate", "endDate", "status" }]
}
```

Rules worth writing into the contract doc:

- **Scope is resolved server-side from the session**, the same as `/search`
  and `/tasks/assigned`. `scope=mine` applies the caller's id **twice**
  (assignment AND workspace membership), for the reason My tasks gives: a
  `TaskAssignee` row survives someone leaving the workspace.
- Excludes soft-deleted tasks, and tasks in a soft-deleted project (Trash rules).
- **Overlap, not containment**, for sprints and projects:
  `startDate < to AND endDate >= from`. A sprint that started last month and
  ends this week must still draw.
- A record with a missing date is simply absent. A sprint without dates can't
  be placed, and that is not an error.
- **No rate limiter** (an authenticated, bounded read, same as the other
  reads), but cached with the existing versioned read-through cache, keyed on
  user + range. The task / sprint / project version bumps already invalidate it.
- Index check: `Task(dueDate)` filtered by project. Add
  `@@index([projectId, dueDate])` if the plan shows a seq scan.

### Phase 2 needs nothing new

Rescheduling is the existing `PATCH /tasks/:id { dueDate }`. Quick add is the
existing `POST` create with `dueDate` set.

### Phase 4

`GET /calendar/feed/:token.ics` (public, token-authenticated, rate-limited per
token), plus `POST /users/me/calendar-token` to rotate. Generate ICS by hand
(it is a small text format) or with `ical-generator`.

---

## 4. Frontend (phase 1)

```
src/app/calendar/
  page.tsx            # Server Component: reads searchParams, fetches, composes
  loading.tsx
  error.tsx
src/components/calendar/
  calendar-toolbar.tsx    # prev / today / next + view + scope links (all <a>)
  month-grid.tsx          # 6×7 grid, server
  week-grid.tsx           # 7 columns + all-day span lanes, server
  agenda-list.tsx         # grouped by day, server, also the mobile view
  calendar-task-chip.tsx
  calendar-span-bar.tsx   # sprint / project bar across cells
src/lib/
  calendar.ts             # API call (GET /calendar)
  calendar-range.ts       # pure: anchor+view → [from,to), grid days, span layout
src/types/calendar.ts
```

- **Pure layout logic in `lib/calendar-range.ts`**: building the week rows,
  placing multi-day bars into lanes without overlap, "+N more" overflow. This
  is the part with bugs in it, so it gets tests the way
  `tests/lib/chat-grouping.test.ts` does (month boundaries, a sprint crossing
  two weeks, DST, a 6-row February vs a 4-row one).
- **No client JS in phase 1.** Navigation is links, so the screen ships no
  JavaScript, like the breakdown and My tasks. Phase 2 adds client leaves for
  drag and quick-add only.
- **Week starts on** the workspace's setting, defaulting to **Saturday or Sunday**
  (an open question, see §6).
- Tokens: task dots use the status `label-*` hues for recognition only. Every
  value is also text (the same accessibility rule as the breakdown, since the
  `label-*` palette fails a colour-only check). Today's cell uses
  `bg-brand-100`, overdue uses `text-danger` on `surface`.
- At 360px: month grid collapses to the agenda list; no horizontal scroll.

---

## 5. Build order and estimate

| # | Step | Size |
| --- | --- | --- |
| 1 | `docs/api/calendar.md` contract | S |
| 2 | backend module + tests (scope, overlap, range cap, deleted rows) | M |
| 3 | `calendar-range.ts` + tests | M |
| 4 | agenda view (simplest, proves the data) | S |
| 5 | month view + span bars | M |
| 6 | week view | M |
| 7 | sidebar row live, CLAUDE.md "Build progress" entry | S |
| **Phase 1 total** | | **~1 week** |
| 8 | Phase 2: drag reschedule, quick add, `?task=` drawer, warnings | ~1 week |
| 9 | Phase 3: `Task.startDate` | 3–4 days |
| 10 | Phase 4: ICS feed | 2–3 days |

---

## 6. Open questions (decide before building)

1. **Default scope.** "Mine" (personal planner) or "workspace" (team view)?
   Recommendation: `mine`, with a one-click toggle. It's the view people
   open daily.
2. **Is `dueDate` a date or a moment?** If it stores a time, a task due
   "23:00 Dhaka" lands on a different UTC day. Recommendation: treat it as a
   **date** (store midnight UTC, render without time). Check how the drawer
   currently writes it.
3. **First day of week:** Saturday (common in Bangladesh), Sunday or Monday?
   Make it a workspace setting.
4. **Cross-workspace?** Should `scope=mine` span every workspace (like My
   tasks) or only the active one? Recommendation: every workspace, since a
   person's week does not split by workspace.
5. **Events (phase 5)**: wanted at all, and is leave the first kind?
