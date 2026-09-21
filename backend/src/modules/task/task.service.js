/**
 * Task business rules. Throws `AppError` on failure; never touches
 * `req`/`res`/Prisma directly.
 *
 * **Authorization is not this file's job.** `loadProject` or `loadTask`, plus
 * `requireProjectContribute` for writes, have already run
 * (shared/middlewares/task.js). What remains here is everything a guard cannot
 * know without looking at the REQUEST's references: whether every assignee is in
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
import activityService from './task-activity.service.js';
import sprintRepository from '../sprint/sprint.repository.js';
import notificationService from '../notification/notification.service.js';
import dto from './task.dto.js';

/*
 * The deepest chain the cycle walk will follow. Nobody nests sub-tasks a
 * hundred deep; a chain that long is a cycle written before this check
 * existed, and stopping is better than a request that never returns.
 */
const MAX_DEPTH = 100;

/*
 * Below this gap two neighbours are too close to take a midpoint of reliably,
 * and the project is respaced first. Far above a double's rounding error at
 * the magnitudes ranks reach, far below any gap a person creates by dragging.
 */
const MIN_RANK_GAP = 1e-6;

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

/** Every assignee must be able to reach the task — i.e. be in the project's workspace. */
const checkAssignees = async (workspaceId, assigneeIds) => {
  if (!assigneeIds?.length) return;

  const memberships = await repository.findWorkspaceMemberships(workspaceId, assigneeIds);
  if (memberships.length !== assigneeIds.length) {
    throw unprocessable('Some of those users are not members of this workspace');
  }
};

/**
 * `assigneeIds` → the nested write that sets them, REPLACING the stored set
 * when `replace` is on. `createdAt` is spaced a millisecond apart so the
 * response lists people in the order the client sent them.
 */
const assigneesWrite = (assigneeIds, replace) => {
  const now = Date.now();

  return {
    ...(replace ? { deleteMany: {} } : {}),
    create: assigneeIds.map((userId, index) => ({ userId, createdAt: new Date(now + index) })),
  };
};

/**
 * A sprint must be one of THIS project's, and not completed — a completed
 * sprint is a record of what it delivered, not somewhere new work can land.
 */
const checkSprint = async (projectId, sprintId) => {
  if (!sprintId) return;

  const sprint = await sprintRepository.findSprintInProject(projectId, sprintId);
  if (!sprint) throw unprocessable('That sprint does not exist in this project');
  if (sprint.state === 'COMPLETED') throw unprocessable('A completed sprint cannot take tasks');
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
  if (!parentId) return null;

  if (parentId === taskId) throw unprocessable('A task cannot be its own ancestor');

  const parent = await repository.findParentLink(parentId);
  if (!parent || parent.projectId !== projectId) {
    throw unprocessable('Parent task not found in this project');
  }

  if (!taskId) return parent;

  let cursor = parent.parentId;
  for (let depth = 0; cursor && depth < MAX_DEPTH; depth += 1) {
    if (cursor === taskId) throw unprocessable('A task cannot be its own ancestor');
    const link = await repository.findParentLink(cursor);
    cursor = link?.parentId ?? null;
  }

  return parent;
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

/**
 * Who is NEWLY on this task, and the sprint they are being pulled into.
 *
 * Newly, not "everyone on it": a patch that changes a due date resends
 * `assigneeIds` unchanged, and notifying the same three people every time
 * anybody touches the card is how a bell becomes noise. The diff is taken
 * against the row as it was BEFORE the write.
 *
 * The sprint name is read here rather than in the notification service because
 * it is the answer to the question this feature exists for — "you were
 * assigned something *in Sprint 3*" — and this is the layer that already knows
 * the task, its project and its sprint.
 */
const notifyNewAssignees = async (before, after, project, user) => {
  const had = new Set((before?.assignees ?? []).map((row) => row.user?.id ?? row.userId));
  const added = (after?.assignees ?? [])
    .map((row) => row.user?.id ?? row.userId)
    .filter((id) => id && !had.has(id));

  if (added.length === 0) return;

  /* Only when the task is actually IN a sprint. A backlog assignment says
     "you were assigned TIZ-42" and nothing more, which is the truth. */
  const sprint = after.sprintId
    ? await sprintRepository.findSprintById(after.sprintId).catch(() => null)
    : null;

  await notificationService.notifyTaskAssigned({
    task: { id: after.id, key: `${project.key}-${after.number}`, title: after.title },
    recipientIds: added,
    actor: user,
    projectName: project.name,
    sprintName: sprint?.name ?? null,
  });
};

/** `POST /projects/:projectId/tasks`. */
const createTask = async (project, payload, user) => {
  const { properties, tags, attachments, ...rest } = payload;

  await checkAssignees(project.workspaceId, rest.assigneeIds);
  const parent = await checkParent(project.id, rest.parentId);
  await checkSprint(project.id, rest.sprintId);
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
    ...(rest.assigneeIds?.length ? { assignees: assigneesWrite(rest.assigneeIds, false) } : {}),
    dueDate: rest.dueDate ?? null,
    completedAt,
    tags: tags ? normalizeTags(tags) : [],
    attachments: attachments ?? [],
    parentId: rest.parentId ?? null,
    /* A new sub-task joins its parent's sprint unless told otherwise — it is a
       piece of the parent's work, wherever that work is planned. */
    sprintId: rest.sprintId !== undefined ? rest.sprintId : (parent?.sprintId ?? null),
    ...(merged ? { properties: merged } : {}),
    type: rest.type ?? undefined,
    storyPoints: rest.storyPoints ?? null,
    createdById: user.id,
  });

  await activityService.recordCreated(row.id, user.id);
  /* A task created with assignees is an assignment too — the `before` is an
     empty set, so everyone on it is new. */
  await notifyNewAssignees(null, row, project, user);

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
 *
 * Also the write behind `moveTask`, which passes `position` — a field the
 * PATCH validator does not accept, so a client can only rank through `/move`,
 * where the neighbours are checked.
 *
 * `user` is optional only for that internal shape's sake; every HTTP caller
 * passes it, and it is who the history entries name.
 */
const updateTask = async (task, project, patch, user = null) => {
  const { properties, tags, attachments, assigneeIds, ...columns } = patch;
  const before = await repository.findTaskById(task.id);

  if (assigneeIds) await checkAssignees(project.workspaceId, assigneeIds);
  if ('parentId' in columns) await checkParent(project.id, columns.parentId, task.id);
  if ('sprintId' in columns) await checkSprint(project.id, columns.sprintId);
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
    ...(assigneeIds ? { assignees: assigneesWrite(assigneeIds, true) } : {}),
  });

  if ('sprintId' in columns && before?.sprintId !== row.sprintId) {
    await repository.moveSubtreeToSprint([task.id], row.sprintId);
  }

  if (before) await activityService.recordChanges(before, row, user?.id ?? null);
  await notifyNewAssignees(before, row, project, user);

  return dto.toTask(row, definitions);
};

/**
 * `PATCH /tasks/:taskId/move` — rank a task between two neighbours, optionally
 * into another status in the same request.
 *
 * `afterId` is the task that will sit directly ABOVE this one, `beforeId` the
 * one directly BELOW; either may be null (top or bottom of the list the client
 * is looking at). The client names neighbours, never a number: the arithmetic,
 * and the respacing it sometimes needs, are the server's, so two clients with
 * different stale copies of the list cannot write colliding ranks.
 *
 *   both      → the midpoint
 *   only above → one step below it
 *   only below → one step above it
 *   neither   → rank unchanged (a status-only move)
 *
 * A neighbour that is the task itself, deleted, or in another project is a
 * `422`, not ignored: silently ranking against half a request would put the
 * task somewhere nobody dropped it.
 */
const moveTask = async (task, project, { statusId, sprintId, afterId, beforeId }, user) => {
  const neighbour = async (id) => {
    if (!id) return null;
    if (id === task.id) throw unprocessable('A task cannot be placed next to itself');

    const link = await repository.findRankLink(project.id, id);
    if (!link) throw unprocessable('Neighbour task not found in this project');
    return link;
  };

  let [above, below] = await Promise.all([neighbour(afterId), neighbour(beforeId)]);

  if (above && below && below.position - above.position < MIN_RANK_GAP) {
    await repository.rebalancePositions(project.id);
    [above, below] = await Promise.all([neighbour(afterId), neighbour(beforeId)]);
  }

  const step = repository.POSITION_STEP;
  const position =
    above && below ? (above.position + below.position) / 2
    : above ? above.position + step
    : below ? below.position - step
    : undefined;

  const patch = {
    ...(statusId ? { statusId } : {}),
    ...(sprintId !== undefined ? { sprintId } : {}),
    ...(position !== undefined ? { position } : {}),
  };

  return updateTask(task, project, patch, user);
};

/** 422 unless every requested id is a live task of this project. De-duplicates first. */
const loadForBulk = async (project, taskIds) => {
  const ids = [...new Set(taskIds)];
  const rows = await repository.findTasksByIds(project.id, ids);

  if (rows.length !== ids.length) {
    throw unprocessable('Some of those tasks were not found in this project');
  }

  return { ids, rows };
};

/**
 * `PATCH /projects/:projectId/tasks/bulk` — one patch applied to many tasks,
 * in one transaction.
 *
 * The patch is deliberately narrower than a single-task PATCH: status, type,
 * priority, assignee, points and due date are the fields a person changes
 * across a selection. Title, description and custom properties are per-task by
 * nature, and a bulk "set description" is a mistake waiting for a click.
 *
 * `completedAt` is computed PER TASK, because the selection can span groups: a
 * bulk move to "Done" stamps the tasks that were not already complete and
 * leaves the stamps on the ones that were.
 */
const bulkUpdateTasks = async (project, { taskIds, patch }, user) => {
  const { rows } = await loadForBulk(project, taskIds);
  const { assigneeIds, ...fields } = patch;

  if (assigneeIds) await checkAssignees(project.workspaceId, assigneeIds);
  if ('sprintId' in patch) await checkSprint(project.id, patch.sprintId);
  const nextStatus = patch.statusId ? await statusService.resolveStatus(project.id, patch.statusId) : null;

  const updates = rows.map((row) => {
    const completedAt = nextStatus ? completedAtFor(row.status?.group, nextStatus.group, {}) : undefined;

    return {
      id: row.id,
      data: {
        ...fields,
        ...(completedAt !== undefined ? { completedAt } : {}),
        ...(assigneeIds ? { assignees: assigneesWrite(assigneeIds, true) } : {}),
      },
    };
  });

  const [updated, definitions] = await Promise.all([
    repository.updateTasks(updates),
    propertyRepository.findPropertiesForProject(project.id),
  ]);

  if ('sprintId' in patch) await repository.moveSubtreeToSprint(rows.map((row) => row.id), patch.sprintId);

  const byId = new Map(rows.map((row) => [row.id, row]));
  await activityService.recordManyChanges(
    updated.map((row) => [byId.get(row.id), row]),
    user.id
  );

  /* Sequential, not `Promise.all`: a bulk assignment of forty tasks would
     otherwise open forty sprint reads and forty fan-out inserts at once, and
     none of it is on the critical path of the response. */
  if (assigneeIds) {
    for (const row of updated) {
      await notifyNewAssignees(byId.get(row.id), row, project, user);
    }
  }

  return updated.map((row) => dto.toTask(row, definitions));
};

/**
 * `POST /projects/:projectId/tasks/bulk-delete`. Same soft delete and sub-task
 * promotion as a single delete, for the whole selection at once.
 */
const bulkDeleteTasks = async (project, { taskIds }) => {
  const { ids } = await loadForBulk(project, taskIds);

  await repository.softDeleteTasks(ids);

  return { deleted: ids.length };
};

/**
 * `DELETE /tasks/:taskId`. Soft, and promotes live sub-tasks to top-level in
 * the same transaction. Comments stay attached to the deleted row — a purge
 * policy is an open question in docs/api/task.md, not this endpoint's call.
 */
const deleteTask = (task) => repository.softDeleteTask(task.id);

/**
 * Every task assigned to the caller, across every project they can still see.
 *
 * NO PROJECT, SO NO PROJECT GUARD — and therefore no `req.project` to pass.
 * Scope comes from the caller's own id in two ways at once: assignment and
 * membership (`findTasksAssignedTo`). This is the same shape the search module
 * takes, and for the same reason: an endpoint that cannot be asked about
 * someone else's work needs no rule saying it must not answer.
 *
 * `state` defaults to `open` because a to-do list is a list of things to do.
 * Completed work is still reachable (`state=done`, or `all`), but a default
 * that buries today's three open tasks under two hundred finished ones is a
 * list nobody opens twice.
 */
const listAssignedTasks = async (user, query) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 50;

  const { rows, total } = await repository.findTasksAssignedTo(user.id, {
    page,
    limit,
    state: query.state ?? 'open',
  });

  return { tasks: rows.map(dto.toAssignedTask), page, limit, total };
};

export default {
  listAssignedTasks,
  createTask,
  listTasks,
  getTask,
  updateTask,
  moveTask,
  bulkUpdateTasks,
  bulkDeleteTasks,
  deleteTask,
};
