/**
 * Project business rules. Throws `AppError` on failure; never touches
 * `req`/`res`/Prisma directly, so every function here is callable from a
 * controller or, later, another service.
 *
 * **Authorization is not this file's job.** `loadMembership`,
 * `requirePermission` and — for everything project-scoped —
 * `shared/middlewares/project.js` have already run by the time any function
 * below executes. This file trusts the project and membership it is handed and
 * does not re-derive or re-check a role.
 *
 * See .claude/plan/project.md and docs/api/project.md
 */

import AppError from '../../shared/utils/AppError.js';
import httpStatus from '../../shared/constants/httpStatus.js';
import { AUTH_CODES } from '../../shared/constants/authCodes.js';
import { deriveKey } from '../../shared/utils/projectKey.js';
import repository from './project.repository.js';
import propertyRepository from './project-property.repository.js';
import propertyService from './project-property.service.js';
import dto from './project.dto.js';
import { CACHE_NS, remember, bumpVersion, hashQuery } from '../../shared/utils/cache.js';

const notFound = () =>
  new AppError(httpStatus.NOT_FOUND, 'Project not found', AUTH_CODES.NOT_FOUND);

/*
 * CACHING — docs/api/project.md §Caching. One version per workspace
 * (`cache:v:projects:<workspaceId>`) covers every cached read below: the list
 * pages and the property definitions. Every write in this file — and the
 * writers in project-property, trash and member that change what a list
 * returns — calls `invalidate(workspaceId)` AFTER its write commits.
 */
const invalidate = (workspaceId) => bumpVersion(CACHE_NS.PROJECTS, workspaceId);

/** The workspace's property schema — read by every DTO here, so cached once per version. */
const definitionsFor = async (workspaceId) =>
  (
    await remember({ namespace: CACHE_NS.PROJECTS, scopeId: workspaceId, parts: ['defs'] }, () =>
      propertyRepository.findPropertiesForWorkspace(workspaceId)
    )
  ).value;

/** The caller's effective role in a row the repository loaded with their membership. */
const viewerRoleFor = (row, userId) =>
  row.ownerId === userId ? 'OWNER' : (row.members?.[0]?.role ?? null);

/**
 * `POST /workspaces/:workspaceId/projects`.
 *
 * The two key paths are not the same operation and are deliberately not merged
 * (plan §2.2): a DERIVED key may be suffixed silently, because the server chose
 * it and a suffix is the expected behaviour; a SUPPLIED key that collides is a
 * `409`, because renaming what somebody typed is hostile.
 */
const createProject = async (payload, workspaceId, user) => {
  const { key: suppliedKey, properties, ...rest } = payload;

  /* Validated against the workspace's live definitions before the insert, so a
     create carrying a bad value fails without writing a project. */
  const merged = properties
    ? await propertyService.mergeProperties(workspaceId, {}, properties)
    : undefined;

  const data = {
    ...rest,
    ...(merged ? { properties: merged } : {}),
    description: rest.description ?? null,
    icon: rest.icon ?? null,
    color: rest.color ?? null,
    startDate: rest.startDate ?? null,
    endDate: rest.endDate ?? null,
    workspaceId,
    ownerId: user.id,
  };

  const definitions = await definitionsFor(workspaceId);

  if (!suppliedKey) {
    const project = await repository.createProjectWithDerivedKey(data, deriveKey(data.name));
    await invalidate(workspaceId);
    return dto.toProject(project, 'OWNER', definitions);
  }

  try {
    const project = await repository.createProjectWithKey(data, suppliedKey);
    await invalidate(workspaceId);
    return dto.toProject(project, 'OWNER', definitions);
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new AppError(
        httpStatus.CONFLICT,
        `Key "${suppliedKey}" is already used by another project in this workspace`,
        AUTH_CODES.CONFLICT
      );
    }
    throw error;
  }
};

/**
 * `GET /workspaces/:workspaceId/projects`. Scoped to the workspace the caller is a member of.
 *
 * Cached per USER, not per workspace: `viewerRole` and the `mine` filter both
 * depend on who is asking, so a shared entry would hand one member another's
 * role. The query is hashed into the key so every filter/sort/page combination
 * is its own entry. `fromCached` reaches the response as top-level metadata.
 */
const listProjects = async (workspaceId, userId, query) => {
  const { page, limit } = query;

  const { value, fromCached } = await remember(
    { namespace: CACHE_NS.PROJECTS, scopeId: workspaceId, parts: ['list', userId, hashQuery(query)] },
    async () => {
      /* One definition query for the whole page, not one per row: every
         project in a workspace shares the same schema. */
      const [{ rows, total: count }, definitions] = await Promise.all([
        repository.findProjectsForWorkspace(workspaceId, userId, query),
        definitionsFor(workspaceId),
      ]);

      return {
        projects: rows.map((row) => dto.toProject(row, viewerRoleFor(row, userId), definitions)),
        total: count,
      };
    }
  );

  return { projects: value.projects, page, limit, total: value.total, fromCached };
};

/**
 * `GET /projects/:projectId`. `loadProject` already fetched the row and
 * resolved the caller's effective role, so this is shaping — there is no second
 * query to make and no membership left to check.
 */
const getProject = async (project, projectRole) => {
  const definitions = await definitionsFor(project.workspaceId);

  return dto.toProject(project, projectRole, definitions);
};

/**
 * `PATCH /projects/:projectId`.
 *
 * The validator already rejected an empty body, already excluded `key`, and
 * already compared the two dates against each other. What it could not do is
 * compare a patch that moves ONE date against the one already stored — its
 * `Joi.ref` only sees the request — so that comparison lives here, where the
 * row is in hand.
 */
const updateProject = async (project, patch, projectRole) => {
  const { properties, ...columns } = patch;

  const startDate = 'startDate' in columns ? columns.startDate : project.startDate;
  const endDate = 'endDate' in columns ? columns.endDate : project.endDate;

  if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
    throw new AppError(
      httpStatus.UNPROCESSABLE_ENTITY,
      'endDate cannot be before startDate',
      AUTH_CODES.VALIDATION_ERROR
    );
  }

  /* A partial map merged over the stored one — `null` on a key deletes it,
     which is what "remove this property row" sends. Validated against the
     workspace's live definitions, so a stale client gets a 422 rather than a
     silently discarded save. */
  const merged = properties
    ? await propertyService.mergeProperties(project.workspaceId, project.properties, properties)
    : undefined;

  const updated = await repository.updateProject(project.id, {
    ...columns,
    ...(merged ? { properties: merged } : {}),
  });
  await invalidate(project.workspaceId);

  const definitions = await definitionsFor(project.workspaceId);

  return dto.toProject(updated, projectRole, definitions);
};

/**
 * `PATCH /projects/:projectId/archive`. Reversible, both directions through
 * the same endpoint.
 *
 * Archiving deliberately does NOT touch `status`: they are independent axes,
 * which is exactly why `ProjectStatus` has no ARCHIVED member (plan §2.1).
 * Writing one from the other would reintroduce the ambiguity the enum was
 * trimmed to avoid.
 */
const setArchived = async (project, isArchived, projectRole) => {
  const updated = await repository.setArchived(project.id, isArchived);
  await invalidate(project.workspaceId);
  const definitions = await definitionsFor(project.workspaceId);

  return dto.toProject(updated, projectRole, definitions);
};

/**
 * `DELETE /projects/:projectId`. Soft: sets `deletedAt`, never a hard delete,
 * and never touches `ProjectMember` rows — a purge policy is an open question
 * in docs/api/project.md, not something this endpoint decides.
 *
 * A second delete of the same project is a `404`, not an idempotent `200`:
 * every read in the repository filters `deletedAt: null`, so the row is gone
 * as far as this API is concerned, and `loadProject` returns 404 before this
 * ever runs.
 */
const deleteProject = async (project) => {
  const deleted = await repository.softDeleteProject(project.id);
  await invalidate(project.workspaceId);
  return deleted;
};

const conflict = (message) => new AppError(httpStatus.CONFLICT, message, AUTH_CODES.CONFLICT);

const unprocessable = (message) =>
  new AppError(httpStatus.UNPROCESSABLE_ENTITY, message, AUTH_CODES.VALIDATION_ERROR);

/**
 * Ownership moves through `transferOwnership` and nowhere else (plan §2.4), so
 * both member-mutating endpoints refuse to touch the owner. The validator
 * already blocks `OWNER` as an incoming *value*; this blocks the owner as a
 * *target*, which is the other half of the same rule.
 */
const rejectIfOwner = (project, userId) => {
  if (project.ownerId === userId) {
    throw conflict('Ownership changes go through the transfer endpoint');
  }
};

/** `GET /projects/:projectId/members`. */
const listMembers = async (projectId, { page, limit }) => {
  const { rows, total } = await repository.findProjectMembers(projectId, { page, limit });

  return { members: rows.map(dto.toProjectMember), page, limit, total };
};

/**
 * `POST /projects/:projectId/members`.
 *
 * The workspace check is not a nicety: a project member with no membership in
 * the project's workspace cannot reach the project at all — `loadProject`
 * 404s them — so the row would describe access that does not exist.
 */
const addMember = async (project, { userId, role }) => {
  const membership = await repository.findWorkspaceMembership(project.workspaceId, userId);

  if (!membership) {
    throw unprocessable('That user is not a member of this workspace');
  }

  try {
    const member = await repository.addProjectMember(project.id, userId, role);
    /* The new member's `viewerRole` and `mine` results change. */
    await invalidate(project.workspaceId);
    return dto.toProjectMember(member);
  } catch (error) {
    if (error?.code === 'P2002') throw conflict('That user is already on this project');
    throw error;
  }
};

/** `PATCH /projects/:projectId/members/:userId`. */
const updateMemberRole = async (project, userId, role) => {
  rejectIfOwner(project, userId);

  const existing = await repository.findProjectMember(project.id, userId);
  if (!existing) throw new AppError(httpStatus.NOT_FOUND, 'Project member not found', AUTH_CODES.NOT_FOUND);

  const member = await repository.updateProjectMemberRole(project.id, userId, role);
  await invalidate(project.workspaceId);

  return dto.toProjectMember(member);
};

/**
 * `DELETE /projects/:projectId/members/:userId`.
 *
 * Removing yourself as a plain member is allowed; removing yourself as the
 * owner is the `rejectIfOwner` case above — a project with no owner is not a
 * state this API can produce.
 */
const removeMember = async (project, userId) => {
  rejectIfOwner(project, userId);

  const existing = await repository.findProjectMember(project.id, userId);
  if (!existing) throw new AppError(httpStatus.NOT_FOUND, 'Project member not found', AUTH_CODES.NOT_FOUND);

  await repository.removeProjectMember(project.id, userId);
  await invalidate(project.workspaceId);
};

/**
 * `PATCH /projects/:projectId/transfer-ownership`.
 *
 * `requireProjectOwner` at the route already proved the caller may do this, so
 * there is no role check here — only the two things about the TARGET that the
 * middleware cannot know.
 */
const transferOwnership = async (project, toUserId, projectRole) => {
  if (project.ownerId === toUserId) {
    throw unprocessable('That user already owns this project');
  }

  const membership = await repository.findWorkspaceMembership(project.workspaceId, toUserId);
  if (!membership) {
    throw unprocessable('That user is not a member of this workspace');
  }

  const updated = await repository.transferOwnership(project.id, project.ownerId, toUserId);
  await invalidate(project.workspaceId);
  const definitions = await definitionsFor(project.workspaceId);

  return dto.toProject(updated, projectRole, definitions);
};

export default {
  notFound,
  viewerRoleFor,
  createProject,
  listProjects,
  getProject,
  updateProject,
  setArchived,
  deleteProject,
  listMembers,
  addMember,
  updateMemberRole,
  removeMember,
  transferOwnership,
  invalidate,
};
