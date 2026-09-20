/**
 * Joi schemas for the task module — request SHAPE only. Whether the assignee
 * is in the workspace, whether the parent is in the project, whether a value
 * fits its property's type: all of those need a query, so all of them are the
 * service's.
 *
 * Two things here look like omissions and are not:
 *
 * - `number` and `projectId` appear in no schema. The number is allocated by
 *   the server from the project's counter (docs/api/task.md §Numbering), and a
 *   task never moves project — moving would renumber it, which breaks every
 *   `TIZ-7` already written down somewhere.
 * - `tags` is not `.unique()`. Duplicates that differ only in case ("API",
 *   "api") are collapsed by the service instead, because rejecting a request
 *   for a duplicate the user cannot see is a worse answer than folding it.
 *
 * `attachments` is `Joi.array()` with no item schema for the same reason
 * `properties` values are `Joi.any()`: the exact rule is
 * `PROPERTY_TYPES.FILES.check`, and a second, Joi-shaped copy of it here would
 * be a second place for the upload shape to change.
 *
 * See .claude/skills/module-consistency/SKILL.md and docs/api/task.md
 */

import Joi from 'joi';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
// Must stay in sync with the TaskType enum in prisma/schema.prisma.
const TYPES = ['TASK', 'STORY', 'BUG', 'EPIC'];

/** How many tasks one bulk request may touch — a backlog screen's worth, not a project export. */
const BULK_MAX = 100;
/** The largest estimate accepted. Past 100 points a task is a project, and should be split. */
const STORY_POINTS_MAX = 100;

const TAGS_MAX = 20;
/** People on one task. Past ten, nobody in particular owns it. */
const ASSIGNEES_MAX = 10;
const TAG_LENGTH_MAX = 40;

const title = Joi.string().trim().min(1).max(200);
const description = Joi.string().trim().max(5000).allow(null, '');
// Same rules as the project's glyph pair (project.validator.js): one emoji
// fits in 8 UTF-16 units even with a skin-tone or ZWJ sequence; colour is hex.
const icon = Joi.string().trim().max(8).allow(null, '');
const color = Joi.string()
  .pattern(/^#[0-9a-fA-F]{6}$/)
  .allow(null, '');
// A `TaskStatusOption` id, not an enum value: statuses are per-project data
// now (docs/api/task.md §Statuses), so whether the id belongs to THIS project
// needs a query and is the service's check. Never null — every task has a
// status; omitted on create means the project default.
const statusId = Joi.string().trim().max(64);
const priority = Joi.string()
  .valid(...PRIORITIES)
  .allow(null);
const type = Joi.string().valid(...TYPES);
// Whole points, 0 allowed (a deliberate "no effort"); null clears the estimate.
const storyPoints = Joi.number().integer().min(0).max(STORY_POINTS_MAX).allow(null);
const id = Joi.string().trim().max(64);
// The WHOLE set of assignees, replacing what was there; [] unassigns everyone.
// Unique, so the join table's primary key is never the thing that says no.
const assigneeIds = Joi.array().items(id).unique().max(ASSIGNEES_MAX);
const date = Joi.date().iso().allow(null);
const tags = Joi.array().items(Joi.string().trim().min(1).max(TAG_LENGTH_MAX)).max(TAGS_MAX);
const attachments = Joi.array();
// A partial { [taskPropertyDefId]: value } map; `null` on a key deletes it.
const properties = Joi.object().pattern(Joi.string(), Joi.any());

const createTaskSchema = Joi.object({
  title: title.required(),
  description: description.optional(),
  type: type.optional(),
  storyPoints: storyPoints.optional(),
  icon: icon.optional(),
  color: color.optional(),
  statusId: statusId.optional(),
  priority: priority.optional(),
  assigneeIds: assigneeIds.optional(),
  dueDate: date.optional(),
  completedAt: date.optional(),
  tags: tags.optional(),
  attachments: attachments.optional(),
  parentId: id.allow(null).optional(),
  sprintId: id.allow(null).optional(),
  properties: properties.optional(),
});

// `.min(1)` rejects `{}` — an empty PATCH is a caller mistake, not a no-op
// success. Same rule as every sibling module.
const updateTaskSchema = Joi.object({
  title: title.optional(),
  description: description.optional(),
  type: type.optional(),
  storyPoints: storyPoints.optional(),
  icon: icon.optional(),
  color: color.optional(),
  statusId: statusId.optional(),
  priority: priority.optional(),
  assigneeIds: assigneeIds.optional(),
  dueDate: date.optional(),
  completedAt: date.optional(),
  tags: tags.optional(),
  attachments: attachments.optional(),
  parentId: id.allow(null).optional(),
  sprintId: id.allow(null).optional(),
  properties: properties.optional(),
})
  .min(1)
  .messages({ 'object.min': 'Provide at least one field to update' });

/*
 * `limit` caps at 500, five times the project list's 100: a backlog is read
 * whole and grouped client-side, and paging a list somebody is dragging tasks
 * around in is a worse bug than a larger payload.
 *
 * `parentId` takes a task id, or the literal `none` for top-level tasks only —
 * a query string has no null, and "no parent" is the question a backlog asks.
 */
const listTasksQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(500).default(200),
  statusId: statusId.optional(),
  q: Joi.string().trim().max(200).optional(),
  parentId: id.optional(),
});

/*
 * `PATCH /tasks/:taskId/move`. Neighbours, never a number — the rank arithmetic
 * is the server's (docs/api/task.md §Ordering). `null` means "no task on that
 * side": the top or the bottom of the list the client is looking at.
 */
const moveTaskSchema = Joi.object({
  statusId: statusId.optional(),
  // The container: a sprint id, or null for the backlog. Planning is a move.
  sprintId: id.allow(null).optional(),
  afterId: id.allow(null).optional(),
  beforeId: id.allow(null).optional(),
})
  .or('statusId', 'sprintId', 'afterId', 'beforeId')
  .messages({ 'object.missing': 'Provide a status, a sprint or a neighbour to move next to' });

const taskIds = Joi.array().items(id.required()).min(1).max(BULK_MAX).required();

/*
 * The fields a selection can share — see `bulkUpdateTasks` for why this is
 * narrower than a single-task PATCH.
 */
const bulkUpdateTasksSchema = Joi.object({
  taskIds,
  patch: Joi.object({
    statusId: statusId.optional(),
    type: type.optional(),
    priority: priority.optional(),
    assigneeIds: assigneeIds.optional(),
    storyPoints: storyPoints.optional(),
    dueDate: date.optional(),
    sprintId: id.allow(null).optional(),
  })
    .min(1)
    .required()
    .messages({ 'object.min': 'Provide at least one field to update' }),
});

const bulkDeleteTasksSchema = Joi.object({ taskIds });

/*
 * `state` is the only filter this list takes, and that is deliberate. The
 * per-project list already has status, search and parent filters; a to-do list
 * that grew the same set would be the backlog again, opened from a different
 * row in the sidebar. What it needs is one switch: what is still on my plate,
 * what did I finish, or everything.
 */
const assignedTasksQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  /* 50, where a project's list allows 500: this one spans every project the
     caller belongs to, so the ceiling is a person's realistic workload rather
     than a whole backlog drawn in one request. */
  limit: Joi.number().integer().min(1).max(200).default(50),
  state: Joi.string().valid('open', 'done', 'all').default('open'),
});

export {
  assignedTasksQuerySchema,
  createTaskSchema,
  updateTaskSchema,
  listTasksQuerySchema,
  moveTaskSchema,
  bulkUpdateTasksSchema,
  bulkDeleteTasksSchema,
};
