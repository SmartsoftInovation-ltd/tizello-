/**
 * Task business rules. Throws `AppError` on failure; never touches
 * `req`/`res`/Prisma directly.
 *
 * **Authorization is not this file's job.** `loadProject` or `loadTask`, plus
 * `requireProjectContribute` for writes, have already run
 * (shared/middlewares/task.js). What remains here is everything a guard cannot
 * know without looking at the REQUEST's references: whether the assignee is in
 * the workspace, whether the parent is in the project and not a descendant,
 * whether a property value fits its type.
 *
 * See docs/api/task.md
 */

import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import { AUTH_CODES } from '../../shared/constants/authCodes.js';
import { PROPERTY_TYPES } from '../../shared/constants/propertyTypes.js';
import repository from './task.repository.js';
import propertyRepository from './task-property.repository.js';
import propertyService from './task-property.service.js';
import statusRepository from './task-status.repository.js';
import statusService from './task-status.service.js';
import dto from './task.dto.js';

/*
 * The deepest chain the cycle walk will follow. Nobody nests sub-tasks a
 * hundred deep; a chain that long is a cycle written before this check
 * existed, and stopping is better than a request that never returns.
 */
const MAX_DEPTH = 100;

const notFound = () => new AppError(httpStatus.NOT_FOUND, 'Task not found', AUTH_CODES.NOT_FOUND);

const unprocessable = (message) =>
  new AppError(httpStatus.UNPROCESSABLE_ENTITY, message, AUTH_CODES.VALIDATION_ERROR);

/** Trimmed, and de-duplicated case-insensitively with the FIRST spelling kept. */
const normalizeTags = (tags) => {
  const seen = new Set();

  return tags.reduce((kept, tag) => {
    const value = tag.trim();
    const folded = value.toLowerCase();
    if (!value || seen.has(folded)) return kept;

    seen.add(folded);
    return [...kept, value];
  }, []);
};

/** The same check a FILES property value gets — one upload shape, one rule. */
const checkAttachments = (attachments) => {
  const problem = PROPERTY_TYPES.FILES.check(attachments);
  if (problem) throw unprocessable(`Attachments ${problem}`);
};

/** An assignee must be able to reach the task — i.e. be in the project's workspace. */
const checkAssignee = async (workspaceId, assigneeId) => {
  if (!assigneeId) return;

  const membership = await repository.findWorkspaceMembership(workspaceId, assigneeId);
  if (!membership) throw unprocessable('That user is not a member of this workspace');
};

/**
 * A parent must be a live task in the SAME project, and must not be the task
 * itself or any of its descendants.
 *
 * The descendant check walks UP from the would-be parent rather than down from
 * the task: a task has one parent and possibly many children, so the upward
 * walk is one row per level where the downward one is a tree.
 */
const checkParent = async (projectId, parentId, taskId = null) => {
  if (!parentId) return;

  if (parentId === taskId) throw unprocessable('A task cannot be its own ancestor');

  const parent = await repository.findParentLink(parentId);
  if (!parent || parent.projectId !== projectId) {
    throw unprocessable('Parent task not found in this project');
  }

  if (!taskId) return;

  let cursor = parent.parentId;
  for (let depth = 0; cursor && depth < MAX_DEPTH; depth += 1) {
    if (cursor === taskId) throw unprocessable('A task cannot be its own ancestor');
    const link = await repository.findParentLink(cursor);
    cursor = link?.parentId ?? null;
  }
};

/**
 * `completedAt` follows the status GROUP unless the request sets it.
 *
 *   into COMPLETE from another group  → now
 *   out of COMPLETE to another group  → null
 *   COMPLETE → COMPLETE ("QA passed" → "Done"), or any move within a group
 *                                     → unchanged
 *   completedAt in the patch          → exactly what was sent
 *
 * The group, not the status name, because names are the project's to choose —
 * "Shipped" and "Archived" both mean finished, and the moment it was finished
 * does not move when a finished task is relabelled. An explicit value always
 * wins, so a task finished last Friday and recorded today can say Friday.
 * Returns `undefined` when nothing should be written.
 */
const completedAtFor = (previousGroup, nextGroup, patch) => {
  if ('completedAt' in patch) return patch.completedAt;
  if (!nextGroup) return undefined;

  const wasComplete = previousGroup === 'COMPLETE';
  const isComplete = nextGroup === 'COMPLETE';

  if (isComplete && !wasComplete) return new Date();
  if (wasComplete && !isComplete) return null;
  return undefined;
};

/** `POST /projects/:projectId/tasks`. */
const createTask = async (project, payload, user) => {
  const { properties, tags, attachments, ...rest } = payload;

  await checkAssignee(project.workspaceId, rest.assigneeId);
  await checkParent(project.id, rest.parentId);
  if (attachments) checkAttachments(attachments);

  /* The requested status (must be this project's), or the project default. */
  const status = await statusService.resolveStatus(project.id, rest.statusId);

  const { merged, definitions } = properties
    ? await propertyService.mergeTaskProperties(project.id, {}, properties)
    : { merged: undefined, definitions: await propertyRepository.findPropertiesForProject(project.id) };

  const completedAt =
    rest.completedAt !== undefined
      ? rest.completedAt
      : status.group === 'COMPLETE'
        ? new Date()
        : null;

  const row = await repository.createTask(project.id, {
    title: rest.title,
    description: rest.description || null,
    icon: rest.icon || null,
    color: rest.color || null,
    statusId: status.id,
    priority: rest.priority ?? null,
    assigneeId: rest.assigneeId ?? null,
    dueDate: rest.dueDate ?? null,
    completedAt,
    tags: tags ? normalizeTags(tags) : [],
    attachments: attachments ?? [],
    parentId: rest.parentId ?? null,
    ...(merged ? { properties: merged } : {}),
    createdById: user.id,
  });

  return dto.toTask(row, definitions);
};

/** `GET /projects/:projectId/tasks`. One definition query for the whole page — every task shares the project's schema. */
const listTasks = async (project, query) => {
  const { page, limit } = query;

  const [{ rows, total }, definitions] = await Promise.all([
    repository.findTasksForProject(project.id, query),
    propertyRepository.findPropertiesForProject(project.id),
  ]);

  return { tasks: rows.map((row) => dto.toTask(row, definitions)), page, limit, total };
};

/** `GET /tasks/:taskId`. `loadTask` proved access; this re-reads with the response's includes. */
const getTask = async (task) => {
  const [row, definitions] = await Promise.all([
    repository.findTaskById(task.id),
    propertyRepository.findPropertiesForProject(task.projectId),
  ]);

  if (!row) throw notFound();

  return dto.toTask(row, definitions);
};

/**
 * `PATCH /tasks/:taskId`. Only fields present in the patch are written; the
 * validator already rejected `{}`.
 */
const updateTask = async (task, project, patch) => {
  const { properties, tags, attachments, ...columns } = patch;

  if ('assigneeId' in columns) await checkAssignee(project.workspaceId, columns.assigneeId);
  if ('parentId' in columns) await checkParent(project.id, columns.parentId, task.id);
  if (attachments) checkAttachments(attachments);

  const { merged, definitions } = properties
    ? await propertyService.mergeTaskProperties(project.id, task.properties, properties)
    : { merged: undefined, definitions: await propertyRepository.findPropertiesForProject(project.id) };

  /* Only a status change can move completedAt, so the two status lookups run
     only when the patch carries one — and the stored status is read by id
     because `loadTask` loaded the bare row. */
  let nextGroup;
  let previousGroup;
  if ('statusId' in columns) {
    const [next, previous] = await Promise.all([
      statusService.resolveStatus(project.id, columns.statusId),
      statusRepository.findStatus(project.id, task.statusId),
    ]);
    nextGroup = next.group;
    previousGroup = previous?.group;
  }

  const completedAt = completedAtFor(previousGroup, nextGroup, patch);

  const row = await repository.updateTask(task.id, {
    ...columns,
    ...('description' in columns ? { description: columns.description || null } : {}),
    ...('icon' in columns ? { icon: columns.icon || null } : {}),
    ...('color' in columns ? { color: columns.color || null } : {}),
    ...(completedAt !== undefined ? { completedAt } : {}),
    ...(tags ? { tags: normalizeTags(tags) } : {}),
    ...(attachments ? { attachments } : {}),
    ...(merged ? { properties: merged } : {}),
  });

  return dto.toTask(row, definitions);
};

/**
 * `DELETE /tasks/:taskId`. Soft, and promotes live sub-tasks to top-level in
 * the same transaction. Comments stay attached to the deleted row — a purge
 * policy is an open question in docs/api/task.md, not this endpoint's call.
 */
const deleteTask = (task) => repository.softDeleteTask(task.id);

export default { createTask, listTasks, getTask, updateTask, deleteTask };
