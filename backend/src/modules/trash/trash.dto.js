/**
 * Row → response shaping for trash entries. A whitelist, like every DTO here.
 *
 * AN ENTRY IS NOT A RECORD. A trashed thing is not being read, it is being
 * recognised and then put back or destroyed — so an entry carries a label, a
 * key, where it lived, when it was deleted, and whether this caller may act on
 * it. Nothing else: a deleted project's description, dates and roll-ups are
 * irrelevant to that decision, and computing them for a list nobody reads
 * would make emptying the bin the most expensive page in the app.
 *
 * `kind` is on every entry so one list can hold two shapes without the client
 * inferring the type from which fields happen to be present.
 *
 * See docs/api/trash.md
 */

const toProjectEntry = (row, canRestore) => ({
  kind: 'project',
  id: row.id,
  name: row.name,
  key: row.key,
  icon: row.icon,
  color: row.color,
  workspaceId: row.workspaceId,
  workspaceName: row.workspace?.name ?? null,
  deletedAt: row.deletedAt,
  canRestore,
});

const toTaskEntry = (row, canRestore) => ({
  kind: 'task',
  id: row.id,
  name: row.title,
  key: `${row.project.key}-${row.number}`,
  type: row.type,
  projectId: row.projectId,
  projectName: row.project.name,
  workspaceId: row.project.workspaceId,
  deletedAt: row.deletedAt,
  canRestore,
});

export default { toProjectEntry, toTaskEntry };
export { toProjectEntry, toTaskEntry };
