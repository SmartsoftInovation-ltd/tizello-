import { apiCallWithRefresh } from "@/lib/api-client";
import type { PermissionGroup, RoleDefinition, RoleInput } from "@/types/permissions";

/*
 * The workspace-role API — `backend/docs/api/role.md`. Replaces
 * `demo-permissions.ts`.
 *
 * NOT `lib/roles.ts`, which is a different job with a confusingly similar
 * name: that one is the frontend's MIRROR of the tier table — `ROLE_LABEL`,
 * `canUpdateWorkspace`, `canChangeMemberRole` — used to decide which controls
 * are drawn. This file talks to the endpoints that define a workspace's own
 * roles.
 *
 * Five endpoints under `/workspaces/:workspaceId/roles`. The catalog
 * (`/roles/permissions`) is fetched rather than declared in the frontend on
 * purpose: the server gates on those ids, and a second copy here is how the
 * matrix ends up offering a switch nothing checks.
 *
 * **The built-ins are not special-cased in this file.** They are rows like any
 * other, seeded server-side on first read, and carry `builtIn: true` — which is
 * the only thing the UI branches on. A frontend that knew the three tiers by
 * name would have to be edited every time the server's idea of them changed.
 */

export type RoleResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: string };

/** `GET /workspaces/:id/roles/permissions` — the matrix's rows. */
export async function getPermissionCatalog(workspaceId: string): Promise<PermissionGroup[]> {
  const result = await apiCallWithRefresh<{ groups: PermissionGroup[] }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/roles/permissions`,
  );

  return result.ok ? result.data.groups : [];
}

/**
 * `GET /workspaces/:id/roles`. Returns `[]` rather than throwing — this runs in
 * a Server Component render, where a throw is a full error page rather than an
 * empty section the rest of the screen survives.
 */
export async function getRoles(workspaceId: string): Promise<RoleDefinition[]> {
  const result = await apiCallWithRefresh<{ roles: RoleDefinition[] }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/roles`,
  );

  return result.ok ? result.data.roles : [];
}

/** `POST /workspaces/:id/roles`. */
export async function createRole(
  workspaceId: string,
  input: RoleInput,
): Promise<RoleResult<RoleDefinition>> {
  const result = await apiCallWithRefresh<{ role: RoleDefinition }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/roles`,
    { method: "POST", body: { ...input, permissions: [...input.permissions] } },
  );

  return result.ok ? { ok: true, data: result.data.role } : { ok: false, code: result.code };
}

/** `PATCH /workspaces/:id/roles/:roleId`. */
export async function updateRole(
  workspaceId: string,
  roleId: string,
  input: Partial<RoleInput>,
): Promise<RoleResult<RoleDefinition>> {
  const result = await apiCallWithRefresh<{ role: RoleDefinition }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/roles/${encodeURIComponent(roleId)}`,
    {
      method: "PATCH",
      body: {
        ...input,
        ...(input.permissions ? { permissions: [...input.permissions] } : {}),
      },
    },
  );

  return result.ok ? { ok: true, data: result.data.role } : { ok: false, code: result.code };
}

/** `DELETE /workspaces/:id/roles/:roleId`. Refused while anyone still holds it. */
export async function deleteRole(
  workspaceId: string,
  roleId: string,
): Promise<RoleResult> {
  const result = await apiCallWithRefresh<{ id: string }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/roles/${encodeURIComponent(roleId)}`,
    { method: "DELETE" },
  );

  return result.ok ? { ok: true, data: undefined } : { ok: false, code: result.code };
}
