/**
 * Business rules for a project's task property definitions, plus the value
 * merge the task service calls on every task create and update.
 *
 * **Authorization is not this file's job.** `loadProject` and
 * `requireProjectWrite` have already run: changing a project's task SCHEMA is
 * for the people who may edit the project, while filling a value in rides the
 * wider `requireProjectContribute` on the task itself (docs/api/task.md
 * §Guards).
 *
 * See docs/api/task.md
 */

import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import { AUTH_CODES } from '../../shared/constants/authCodes.js';
import { OPTION_TYPES, PROPERTY_TYPES } from '../../shared/constants/propertyTypes.js';
import repository from './task-property.repository.js';
import dto from './task-property.dto.js';

const notFound = () =>
  new AppError(httpStatus.NOT_FOUND, 'Property not found', AUTH_CODES.NOT_FOUND);

const conflict = (message) => new AppError(httpStatus.CONFLICT, message, AUTH_CODES.CONFLICT);

const unprocessable = (message) =>
  new AppError(httpStatus.UNPROCESSABLE_ENTITY, message, AUTH_CODES.VALIDATION_ERROR);

const duplicateName = (name) =>
  conflict(`A property called "${name}" already exists in this project`);

const listProperties = async (projectId) => {
  const rows = await repository.findPropertiesForProject(projectId);

  return rows.map(dto.toTaskProperty);
};

const createProperty = async (projectId, input) => {
  try {
    const row = await repository.createProperty(projectId, input);
    return dto.toTaskProperty(row);
  } catch (error) {
    if (error?.code === 'P2002') throw duplicateName(input.name);
    throw error;
  }
};

/**
 * `type` is not patchable, so `options` is checked against the STORED type —
 * the half of the options-belong-to-select rule a request schema cannot see.
 */
const updateProperty = async (projectId, propertyId, patch) => {
  const existing = await repository.findProperty(projectId, propertyId);
  if (!existing) throw notFound();

  if (patch.options !== undefined && !OPTION_TYPES.includes(existing.type)) {
    throw unprocessable('Only Select and Multi-select properties can have options');
  }

  try {
    const row = await repository.updateProperty(propertyId, patch);
    return dto.toTaskProperty(row);
  } catch (error) {
    if (error?.code === 'P2002') throw duplicateName(patch.name);
    throw error;
  }
};

/** Deletes the definition only; every task's stored value is orphaned and dropped by the task DTO. */
const deleteProperty = async (projectId, propertyId) => {
  const existing = await repository.findProperty(projectId, propertyId);
  if (!existing) throw notFound();

  await repository.deleteProperty(propertyId);
};

/**
 * Merges an incoming `{ [defId]: value }` patch over a task's stored map,
 * validating each value against its definition's type with the SAME table
 * project properties use (`shared/constants/propertyTypes.js`).
 *
 *   - `null` deletes the key.
 *   - An unknown definition id is a `422`, never a silent drop — the client is
 *     out of date with the project's schema and should hear about it.
 *   - Stored keys whose definition was since deleted are left alone.
 *
 * Returns `{ merged, definitions }` so the caller can shape its response
 * without a second query for the same list.
 */
const mergeTaskProperties = async (projectId, stored, patch) => {
  const definitions = await repository.findPropertiesForProject(projectId);
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));

  const merged = { ...(stored ?? {}) };

  for (const [id, value] of Object.entries(patch)) {
    const definition = byId.get(id);
    if (!definition) throw unprocessable('That property no longer exists in this project');

    if (value === null) {
      delete merged[id];
      continue;
    }

    const problem = PROPERTY_TYPES[definition.type].check(value, definition);
    if (problem) throw unprocessable(`${definition.name} ${problem}`);

    merged[id] = value;
  }

  return { merged, definitions };
};

export default {
  listProperties,
  createProperty,
  updateProperty,
  deleteProperty,
  mergeTaskProperties,
};
