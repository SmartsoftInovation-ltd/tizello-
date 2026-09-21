import { apiCallWithRefresh } from "@/lib/api-client";
import { fieldErrorsFrom } from "@/lib/field-errors";
import type { Workspace } from "@/types/workspace";

/*
 * The workspace API — `backend/docs/api/workspace.md`. Replaces the
 * `getWorkspaces()` / `getWorkspace()` pair in `demo-data.ts` for the grid and
 * create flow; the still-fixture-backed detail/members/projects screens are a
 * separate migration (those endpoints don't exist yet).
 *
 * Every call goes through `apiCallWithRefresh`: these are all
 * authenticated, and a 15-minute access token expiring mid-session should
 * renew transparently rather than bouncing the user to sign-in.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: string; fieldErrors?: Record<string, string> };

type ApiWorkspace = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isArchived: boolean;
  role: Workspace["role"];
  createdAt: string;
  updatedAt: string;
};

const toWorkspace = (row: ApiWorkspace): Workspace => row;

/**
 * One membership as the roster returns it.
 *
 * `id` is the membership, `userId` is the person — and `userId` is what every
 * other endpoint takes (adding a project member, transferring ownership), so a
 * caller that confuses the two gets a 404 rather than silent nonsense.
 */
export type WorkspaceMemberRow = {
  id: string;
  userId: string;
  role: Workspace["role"];
  /** The workspace-defined role they hold, or null for the tier's default grant. */
  roleId?: string | null;
  roleName?: string | null;
  createdAt: string;
  user?: { id: string; name: string | null; email: string };
};

/**
 * `GET /workspaces`. 100 is the API's page-size ceiling — see workspace.md §2.
 *
 * `includeArchived` has to be a parameter rather than a filter on the result:
 * the API omits archived rows entirely unless it is sent, so an archived
 * workspace is not in the payload to filter. It is what `/workspaces?archived=1`
 * passes through, and what makes an archived workspace reachable again after
 * `setWorkspaceArchived` has hidden it.
 */
export async function getWorkspaces({
  includeArchived = false,
}: { includeArchived?: boolean } = {}): Promise<Workspace[]> {
  const query = includeArchived ? "?limit=100&includeArchived=true" : "?limit=100";
  const result = await apiCallWithRefresh<ApiWorkspace[]>(`/workspaces${query}`);

  return result.ok ? result.data.map(toWorkspace) : [];
}

/** `GET /workspaces/:id`. `null` covers both "not a member" and "doesn't exist" — the API answers both with the same 404 (workspace.md §*Guards*). */
export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  const result = await apiCallWithRefresh<{ workspace: ApiWorkspace }>(
    `/workspaces/${encodeURIComponent(workspaceId)}`,
  );

  return result.ok ? toWorkspace(result.data.workspace) : null;
}

/**
 * `GET /workspaces/:id/members`. The roster, owner first.
 *
 * This is what resolves a `userId` to a name — the project list, the owner
 * column and the collaborator picker all needed it and none of them had it
 * until this endpoint existed. Returns `[]` on failure, including the `404` a
 * non-member gets: the caller has already resolved the workspace, so a failure
 * here is a picker with nobody in it rather than a thrown page.
 */
export async function getWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMemberRow[]> {
  const result = await apiCallWithRefresh<{ members: WorkspaceMemberRow[] }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/members`,
  );

  return result.ok ? result.data.members : [];
}

/** `POST /workspaces`. `slug` is never sent — the API generates it. */
export async function createWorkspace(input: {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}): Promise<ActionResult<Workspace>> {
  const result = await apiCallWithRefresh<{ workspace: ApiWorkspace }>("/workspaces", {
    method: "POST",
    body: input,
  });

  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      fieldErrors: fieldErrorsFrom(result.details),
    };
  }

  return { ok: true, data: toWorkspace(result.data.workspace) };
}

/** `PATCH /workspaces/:id`. Caller is responsible for sending only changed fields — the API rejects an empty body. */
export async function updateWorkspace(
  workspaceId: string,
  patch: { name?: string; description?: string | null; icon?: string | null; color?: string | null },
): Promise<ActionResult<Workspace>> {
  const result = await apiCallWithRefresh<{ workspace: ApiWorkspace }>(
    `/workspaces/${encodeURIComponent(workspaceId)}`,
    { method: "PATCH", body: patch },
  );

  if (!result.ok) {
    return { ok: false, code: result.code, fieldErrors: fieldErrorsFrom(result.details) };
  }

  return { ok: true, data: toWorkspace(result.data.workspace) };
}

/** `PATCH /workspaces/:id/archive`. OWNER/ADMIN only — the API's `403` surfaces as `code: "FORBIDDEN"`. */
export async function setWorkspaceArchived(
  workspaceId: string,
  isArchived: boolean,
): Promise<ActionResult<Workspace>> {
  const result = await apiCallWithRefresh<{ workspace: ApiWorkspace }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/archive`,
    { method: "PATCH", body: { isArchived } },
  );

  return result.ok
    ? { ok: true, data: toWorkspace(result.data.workspace) }
    : { ok: false, code: result.code };
}

/** `DELETE /workspaces/:id`. Soft-delete, OWNER only — not reversible through this app. */
export async function deleteWorkspace(workspaceId: string): Promise<ActionResult> {
  const result = await apiCallWithRefresh(`/workspaces/${encodeURIComponent(workspaceId)}`, {
    method: "DELETE",
  });

  return result.ok ? { ok: true, data: undefined } : { ok: false, code: result.code };
}
