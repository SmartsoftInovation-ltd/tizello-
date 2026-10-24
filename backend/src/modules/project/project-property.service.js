/**
 * Business rules for property definitions, plus the value validator the
 * project module calls on every `PATCH /projects/:id`.
 *
 * **Authorization is not this file's job.** `loadMembership` and
 * `requirePermission(PROJECT_MANAGE_ANY)` have already run — editing the
 * SCHEMA is admin-only, editing a VALUE is not, and that split lives in the
 * routes (plan §4).
 *
 * See .claude/plan/project-property.md and docs/api/project-property.md
 */

import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import { AUTH_CODES } from '../../shared/constants/authCodes.js';
import { OPTION_TYPES, PROPERTY_TYPES } from '../../shared/constants/propertyTypes.js';
import repository from './project-property.repository.js';
import dto from './project-property.dto.js';
import { CACHE_NS, bumpVersion, remember } from '../../shared/utils/cache.js';

const notFound = () =>
  new AppError(httpStatus.NOT_FOUND, 'Property not found', AUTH_CODES.NOT_FOUND);

const conflict = (message) => new AppError(httpStatus.CONFLICT, message, AUTH_CODES.CONFLICT);

const unprocessable = (message) =>
  new AppError(httpStatus.UNPROCESSABLE_ENTITY, message, AUTH_CODES.VALIDATION_ERROR);

/**
 * The same cache entry `project.service.js#definitionsFor` reads (`…:defs`
 * under the PROJECTS version), so a list render warms this endpoint and vice
 * versa. Every write below bumps that version.
 */
const listProperties = async (workspaceId) => {
  const { value: rows } = await remember(
    { namespace: CACHE_NS.PROJECTS, scopeId: workspaceId, parts: ['defs'] },
    () => repository.findPropertiesForWorkspace(workspaceId)
  );

  return rows.map(dto.toProperty);
};

const createProperty = async (workspaceId, input) => {
  try {
    const row = await repository.createProperty(workspaceId, input);
    /* Every cached project DTO in the workspace renders `properties` against
       the definition list, so a schema change invalidates them all. */
    await bumpVersion(CACHE_NS.PROJECTS, workspaceId);
    return dto.toProperty(row);
  } catch (error) {
    if (error?.code === 'P2002') {
      throw conflict(`A property called "${input.name}" already exists in this workspace`);
    }
    throw error;
  }
};

/**
 * `type` is not patchable, so `options` has to be checked against the STORED
 * type — the request does not carry one. This is the half of the
 * options-belong-to-select rule the validator structurally cannot enforce.
 */
const updateProperty = async (workspaceId, propertyId, patch) => {
  const existing = await repository.findProperty(workspaceId, propertyId);
  if (!existing) throw notFound();

  if (patch.options !== undefined && !OPTION_TYPES.includes(existing.type)) {
    throw unprocessable('Only Select and Multi-select properties can have options');
  }

  try {
    const row = await repository.updateProperty(propertyId, patch);
    await bumpVersion(CACHE_NS.PROJECTS, workspaceId);
    return dto.toProperty(row);
  } catch (error) {
    if (error?.code === 'P2002') {
      throw conflict(`A property called "${patch.name}" already exists in this workspace`);
    }
    throw error;
  }
};

/**
 * Deletes the definition and nothing else.
 *
 * Every project's stored value for it is left in place — the project DTO emits
 * a value only when its definition still exists, so the property is gone from
 * every response the moment this row is, and deleting is O(1) rather than a
 * rewrite of every project in the workspace (plan §2.4).
 */
const deleteProperty = async (workspaceId, propertyId) => {
  const existing = await repository.findProperty(workspaceId, propertyId);
  if (!existing) throw notFound();

  await repository.deleteProperty(propertyId);
  await bumpVersion(CACHE_NS.PROJECTS, workspaceId);
};

/**
 * Merges an incoming `{ [defId]: value }` patch over a project's stored map,
 * validating every value against its own definition's type.
 *
 * Called by `project.service.js` — it is here, not there, because the type
 * table and the definition lookup both belong to this module and a second
 * copy of this loop is a second place for a type to be added to only one.
 *
 * Rules:
 *   - `null` DELETES the key. It is the only way to clear a property, and it
 *     is what the frontend's "remove this row" sends.
 *   - An unknown definition id is a `422`, never a silent drop: it means the
 *     client is out of date with the workspace's schema, and discarding the
 *     save without saying so is the worst possible answer to that.
 *   - Keys already stored whose definition has since been deleted are left
 *     untouched rather than stripped (§2.4).
 */
const mergeProperties = async (workspaceId, stored, patch) => {
  const definitions = await repository.findPropertiesForWorkspace(workspaceId);
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));

  const merged = { ...(stored ?? {}) };

  for (const [id, value] of Object.entries(patch)) {
    const definition = byId.get(id);
    if (!definition) throw unprocessable('That property no longer exists in this workspace');

    if (value === null) {
      delete merged[id];
      continue;
    }

    const problem = PROPERTY_TYPES[definition.type].check(value, definition);
    if (problem) throw unprocessable(`${definition.name} ${problem}`);

    merged[id] = value;
  }

  return merged;
};

export default {
  listProperties,
  createProperty,
  updateProperty,
  deleteProperty,
  mergeProperties,
};
