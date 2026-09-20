/**
 * Row → response shaping for search hits. A whitelist, like every DTO here.
 *
 * A HIT IS NOT A RECORD. Each of these carries only what a result row needs to
 * render and to be navigated to: a label, a key, where it lives, and the ids
 * that build its URL. Returning the full task — description, properties,
 * assignees, comment counts — would make one keystroke of a type-ahead heavier
 * than opening the task itself.
 *
 * Every hit carries `workspaceId` and `projectId` because the client has to
 * build a link to somewhere it may never have been: a search that finds a task
 * in another workspace and cannot navigate to it has not found it.
 *
 * `key` is derived (`TIZ-12`, `SPR-4`), never stored — the same rule
 * `task.dto.js` and `sprint.dto.js` follow. Dates are `YYYY-MM-DD` for the
 * reason `sprint.dto.js` gives: these run over calendar days, and a timestamp
 * would shift them a day for anyone west of UTC.
 *
 * See docs/api/search.md
 */

const day = (date) => (date ? new Date(date).toISOString().slice(0, 10) : null);

const toTaskHit = (row) => ({
  id: row.id,
  key: `${row.project.key}-${row.number}`,
  title: row.title,
  type: row.type,
  dueDate: day(row.dueDate),
  status: row.status ? { id: row.status.id, name: row.status.name, color: row.status.color, group: row.status.group } : null,
  projectId: row.projectId,
  projectName: row.project.name,
  workspaceId: row.project.workspaceId,
  /* Which board the task is ON, so a hit can link to the screen that actually
     shows it: a task in a sprint is not in the backlog and vice versa. `null`
     is the backlog. */
  sprintId: row.sprintId,
});

const toProjectHit = (row) => ({
  id: row.id,
  key: row.key,
  name: row.name,
  status: row.status,
  icon: row.icon,
  color: row.color,
  workspaceId: row.workspaceId,
  workspaceName: row.workspace?.name ?? null,
});

const toSprintHit = (row) => ({
  id: row.id,
  key: `SPR-${row.number}`,
  name: row.name,
  state: row.state,
  startDate: day(row.startDate),
  endDate: day(row.endDate),
  projectId: row.projectId,
  projectName: row.project.name,
  workspaceId: row.project.workspaceId,
});

export default { toTaskHit, toProjectHit, toSprintHit };
