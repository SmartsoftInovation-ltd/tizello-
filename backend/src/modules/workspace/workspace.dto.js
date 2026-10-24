/**
 * Row → response shaping for workspaces. A whitelist, like `auth.dto.js` —
 * never a `delete row.field` blacklist, so a column added to the model later
 * cannot leak by default.
 *
 * `plan` / `planExpiresAt` / `seatLimit` / `lastPaymentAt` are deliberately
 * absent. They exist on the row today (schema-only, ahead of the SSLCommerz
 * work) but no endpoint in this module reads or writes them, and this DTO is
 * what keeps them out of every response until a billing contract says
 * otherwise — see docs/api/workspace.md's sibling-contract-check §2.
 *
 * `role` is a parameter, not a column: it is the caller's own membership role
 * in this workspace, stamped on per response so a client knows what it may
 * do without a second call.
 *
 * See docs/api/workspace.md
 */

const toWorkspace = (row, role) => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description,
  icon: row.icon,
  color: row.color,
  isArchived: row.isArchived,
  role,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/*
 * `toWorkspaceMember` lived here and is now `toMember` in
 * `src/modules/member/member.dto.js`, unchanged. The roster's writes live in
 * that module, and one response shape cannot have two owners.
 */

const PROJECT_STATUSES = ['BACKLOG', 'PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const zeroStatuses = () => Object.fromEntries(PROJECT_STATUSES.map((status) => [status, 0]));

/**
 * `GET /workspaces/overview` — the dashboard on `/workspaces`. Folds the three
 * aggregate result sets from `findOverviewForUser` into one per-workspace row
 * plus cross-workspace totals. Every status and group is present with a zero,
 * so the client never has to guess whether a missing key means "none" or
 * "not sent".
 */
const toOverview = ({ workspaces, projects, tasks }) => {
  const rows = workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    icon: w.icon,
    color: w.color,
    members: w.members,
    activeSprints: w.activeSprints,
    projects: zeroStatuses(),
    tasks: { TODO: 0, IN_PROGRESS: 0, COMPLETE: 0 },
    overdue: 0,
    openPoints: 0,
  }));
  const byId = new Map(rows.map((row) => [row.id, row]));

  for (const p of projects) {
    const row = byId.get(p.workspaceId);
    if (row && p.status in row.projects) row.projects[p.status] = p.count;
  }
  for (const t of tasks) {
    const row = byId.get(t.workspaceId);
    if (!row || !(t.group in row.tasks)) continue;
    row.tasks[t.group] = t.count;
    row.overdue += t.overdue;
    if (t.group !== 'COMPLETE') row.openPoints += t.points;
  }

  const sum = (pick) => rows.reduce((total, row) => total + pick(row), 0);
  const projectsByStatus = zeroStatuses();
  for (const row of rows) for (const status of PROJECT_STATUSES) projectsByStatus[status] += row.projects[status];

  return {
    totals: {
      workspaces: rows.length,
      projects: sum((row) => Object.values(row.projects).reduce((a, b) => a + b, 0)),
      openTasks: sum((row) => row.tasks.TODO + row.tasks.IN_PROGRESS),
      doneTasks: sum((row) => row.tasks.COMPLETE),
      overdueTasks: sum((row) => row.overdue),
      activeSprints: sum((row) => row.activeSprints),
    },
    projectsByStatus,
    workspaces: rows.map((row) => ({
      ...row,
      projectCount: Object.values(row.projects).reduce((a, b) => a + b, 0),
    })),
  };
};

export { toWorkspace, toOverview };
export default { toWorkspace, toOverview };
