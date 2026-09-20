/*
 * Minimal, type-correct builders for the domain records the lib modules take.
 *
 * Relative imports throughout: Node resolves no `@/*` alias, and these files
 * are loaded directly by `node --test`. (`tests/alias-hook.mjs` covers the
 * aliases that live inside the SOURCE modules; test code does not rely on it.)
 */
import type { ProjectRecord, ProjectStatus } from "../src/types/project.ts";
import type { ProjectSprint } from "../src/types/project-sprint.ts";
import type {
  AssignedTask,
  Task,
  TaskStatusGroup,
  TaskStatusOption,
} from "../src/types/task.ts";

export function status(
  id: string,
  group: TaskStatusGroup = "TODO",
): TaskStatusOption {
  return {
    id,
    name: id,
    color: "gray",
    group,
    projectId: "p1",
    position: 0,
    isDefault: false,
    taskCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

export function task(over: Partial<Task> = {}): Task {
  return {
    id: "t1",
    projectId: "p1",
    number: 1,
    key: "TIZ-1",
    title: "Task",
    description: null,
    type: "TASK",
    storyPoints: null,
    position: 1024,
    icon: null,
    color: null,
    statusId: "todo",
    status: { id: "todo", name: "To-do", color: "gray", group: "TODO" },
    priority: null,
    assignees: [],
    dueDate: null,
    completedAt: null,
    tags: [],
    attachments: [],
    parentId: null,
    parent: null,
    sprintId: null,
    sprint: null,
    subtaskCount: 0,
    commentCount: 0,
    properties: {},
    createdById: null,
    createdBy: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

export function assigned(over: Partial<AssignedTask> = {}): AssignedTask {
  return {
    ...task(over),
    project: { id: "p1", key: "TIZ", name: "Tizello", workspaceId: "w1" },
    ...over,
  };
}

export function person(id: string, name: string | null = id) {
  return { id, name, email: `${id}@example.com` };
}

export function project(
  id: string,
  projectStatus: ProjectStatus,
  over: Partial<ProjectRecord> = {},
): ProjectRecord {
  return {
    id,
    key: id.toUpperCase(),
    name: id,
    description: null,
    status: projectStatus,
    priority: "MEDIUM",
    icon: null,
    color: null,
    startDate: null,
    endDate: null,
    isArchived: false,
    workspaceId: "w1",
    ownerId: "u1",
    viewerRole: "OWNER",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    properties: {},
    ...over,
  };
}

export function sprint(over: Partial<ProjectSprint> = {}): ProjectSprint {
  return {
    id: "s1",
    projectId: "p1",
    number: 1,
    key: "SPR-1",
    name: "Sprint 1",
    goal: null,
    startDate: null,
    endDate: null,
    capacityPoints: null,
    state: "PLANNING",
    startedAt: null,
    completedAt: null,
    createdById: null,
    taskCount: 0,
    doneCount: 0,
    totalPoints: 0,
    donePoints: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}
