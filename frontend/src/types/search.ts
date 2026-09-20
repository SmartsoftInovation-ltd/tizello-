import type { ProjectStatus } from "@/types/project";
import type { ProjectSprintState } from "@/types/project-sprint";
import type { StatusColor, TaskStatusGroup, TaskType } from "@/types/task";

/*
 * Search hits, mirroring `backend/docs/api/search.md`.
 *
 * A HIT IS NOT A RECORD, and these types say so on purpose. Each one carries a
 * label, a key, where it lives, and the ids needed to build its URL — nothing
 * more. They are deliberately NOT `Task`, `ProjectRecord` and `ProjectSprint`
 * with fields made optional: a palette row that can be handed to a component
 * expecting a whole task is a palette row that will be, and then the missing
 * half surfaces as `undefined` somewhere far from here.
 *
 * `workspaceId` rides on every hit because a result can live somewhere the
 * reader has never been, and a search that finds a task it cannot link to has
 * not found it.
 */

export type TaskHit = {
  id: string;
  /** `TIZ-12` — derived by the server, never stored. */
  key: string;
  title: string;
  type: TaskType;
  dueDate: string | null;
  status: { id: string; name: string; color: StatusColor; group: TaskStatusGroup } | null;
  projectId: string;
  projectName: string;
  workspaceId: string;
  /** Which board shows it — `null` is the backlog. */
  sprintId: string | null;
};

export type ProjectHit = {
  id: string;
  key: string;
  name: string;
  status: ProjectStatus;
  icon: string | null;
  color: string | null;
  workspaceId: string;
  workspaceName: string | null;
};

export type SprintHit = {
  id: string;
  key: string;
  name: string;
  state: ProjectSprintState;
  startDate: string | null;
  endDate: string | null;
  projectId: string;
  projectName: string;
  workspaceId: string;
};

export type SearchResults = {
  query: string;
  tasks: TaskHit[];
  projects: ProjectHit[];
  sprints: SprintHit[];
};

/** The server's own floor (`docs/api/search.md`), kept here so the field stays quiet below it. */
export const SEARCH_MIN_LENGTH = 2;

export const EMPTY_RESULTS: SearchResults = { query: "", tasks: [], projects: [], sprints: [] };
