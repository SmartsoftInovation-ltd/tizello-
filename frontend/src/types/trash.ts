/*
 * Trash entries, mirroring `backend/docs/api/trash.md`.
 *
 * ONE SHAPE FOR BOTH KINDS, discriminated by `kind`, so a row renders without
 * branching on which fields happen to be present — `name` already carries the
 * project's name or the task's title. An entry is NOT a record: it holds what
 * is needed to recognise the thing and decide its fate, nothing more.
 *
 * `canRestore` is the server's answer for THIS caller on THIS entry — roles
 * differ per workspace, so it is per row rather than per list. It draws the
 * button; the endpoint still enforces.
 */

type TrashBase = {
  id: string;
  /** The project's name, or the task's title. */
  name: string;
  key: string;
  workspaceId: string;
  /** ISO timestamp of the deletion. */
  deletedAt: string;
  canRestore: boolean;
};

export type TrashProject = TrashBase & {
  kind: "project";
  icon: string | null;
  color: string | null;
  workspaceName: string | null;
};

export type TrashTask = TrashBase & {
  kind: "task";
  type: string;
  projectId: string;
  projectName: string;
};

export type TrashEntry = TrashProject | TrashTask;

export type Trash = { projects: TrashProject[]; tasks: TrashTask[] };

export const EMPTY_TRASH: Trash = { projects: [], tasks: [] };
