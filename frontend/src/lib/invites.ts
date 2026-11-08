import { apiCall, apiCallWithRefresh } from "@/lib/api-client";
import { sortInvitations } from "@/lib/invite-sort";
import type {
  InvitationLookup,
  InvitableRole,
  PendingInvitation,
  WorkspaceInvitation,
} from "@/types/workspace";

export { sortInvitations };

/*
 * The invitations API — `GET /workspaces/:id/invitations` and
 * `GET /invitations/:token`, plus the accept/decline/revoke writes.
 *
 * Replaces `demo-invites.ts`, keeping the same function signatures so the
 * migration was confined to this file and its import sites.
 *
 * **The three dead states stay collapsed.** The API answers 404 for revoked,
 * declined, already-accepted and never-existed alike, and this file maps all of
 * them to `UNKNOWN` rather than inventing a fourth state — the shipped copy for
 * `UNKNOWN` already reads "mistyped, cancelled, or already used", and
 * distinguishing them would tell a token-guesser that a token was once real.
 * Only 410 becomes `EXPIRED`, because that is the one recoverable case.
 */

type ApiInvitation = {
  id: string;
  email: string;
  role: InvitableRole;
  roleId?: string | null;
  roleName?: string | null;
  status: "PENDING";
  invitedByName: string | null;
  expiresAt: string;
  createdAt: string;
};

export async function getPendingInvitations(
  workspaceId: string,
): Promise<PendingInvitation[]> {
  if (!workspaceId) return [];

  const result = await apiCallWithRefresh<{ invitations: ApiInvitation[] }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/invitations`,
  );

  if (!result.ok) return [];

  return sortInvitations(
    result.data.invitations.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      roleName: row.roleName ?? null,
      /* The list type calls it `invitedAt`; the API calls it `createdAt`. Same
         instant, and both are ISO 8601 UTC strings so they cross the RSC
         boundary and format identically on server and client. */
      invitedAt: row.createdAt,
      status: "PENDING" as const,
    })),
  );
}

/**
 * `GET /invitations/:token`. Unauthenticated — the recipient has no account
 * yet, which is the entire situation this endpoint exists for.
 */
export async function getInvitation(token: string): Promise<InvitationLookup> {
  const result = await apiCall<{ invitation: WorkspaceInvitation }>(
    `/invitations/${encodeURIComponent(token)}`,
  );

  if (result.ok) {
    return { status: "VALID", invitation: result.data.invitation };
  }

  return result.status === 410 ? { status: "EXPIRED" } : { status: "UNKNOWN" };
}

/** `POST /workspaces/:id/invitations`. */
export async function createInvitation(input: {
  workspaceId: string;
  email: string;
  role: InvitableRole;
  /** A workspace role row; its `baseRole` must match `role`. */
  roleId?: string | null;
}): Promise<{ ok: true } | { ok: false; code: string }> {
  const result = await apiCallWithRefresh(
    `/workspaces/${encodeURIComponent(input.workspaceId)}/invitations`,
    {
      method: "POST",
      body: { email: input.email, role: input.role, ...(input.roleId ? { roleId: input.roleId } : {}) },
    },
  );

  return result.ok ? { ok: true } : { ok: false, code: result.code };
}

/**
 * `DELETE /workspaces/:id/invitations/:id` — revoke.
 *
 * The row is not deleted server-side; it is marked revoked and keeps its audit
 * trail. From here it is simply gone, which is why nothing comes back.
 */
export async function revokeInvitation(
  workspaceId: string,
  invitationId: string,
): Promise<boolean> {
  const result = await apiCallWithRefresh(
    `/workspaces/${encodeURIComponent(workspaceId)}/invitations/${encodeURIComponent(invitationId)}`,
    { method: "DELETE" },
  );

  return result.ok;
}

/** `POST .../invitations/:id/resend`. Rotates the token; the old link dies. */
export async function resendInvitation(
  workspaceId: string,
  invitationId: string,
): Promise<boolean> {
  const result = await apiCallWithRefresh(
    `/workspaces/${encodeURIComponent(workspaceId)}/invitations/${encodeURIComponent(invitationId)}/resend`,
    { method: "POST" },
  );

  return result.ok;
}

/**
 * `POST /invitations/:token/accept`.
 *
 * Idempotent server-side: accepting twice returns 200 both times with one
 * membership row, so a double-clicked button is not an error state here either.
 */
export async function acceptInvitation(
  token: string,
): Promise<{ ok: true; workspaceId: string } | { ok: false; code: string }> {
  const result = await apiCallWithRefresh<{ workspaceId: string }>(
    `/invitations/${encodeURIComponent(token)}/accept`,
    { method: "POST" },
  );

  return result.ok
    ? { ok: true, workspaceId: result.data.workspaceId }
    : { ok: false, code: result.code };
}

/** `POST /invitations/:token/decline`. */
export async function declineInvitation(token: string): Promise<boolean> {
  const result = await apiCallWithRefresh(
    `/invitations/${encodeURIComponent(token)}/decline`,
    { method: "POST" },
  );

  return result.ok;
}

/**
 * Pulls the raw invitation token back out of a `next` destination.
 *
 * `/invite/[token]` is the only route that carries one, and `InviteSignedOut`
 * is what puts it there: an invited recipient reaches `/sign-up` as
 * `?next=/invite/<token>`. Registering with that token attached is what breaks
 * the invite deadlock — the API marks the account verified and returns a
 * session, so there is no verification wall on a path that never sends a
 * verification email.
 *
 * The argument must already have passed `safeNextPath`; this only reads the
 * shape, it does not vouch for the destination. Returns undefined for every
 * other route, so an ordinary sign-up is unaffected.
 */
export function inviteTokenFromNext(next: string | null | undefined) {
  if (!next) return undefined;

  const match = /^\/invite\/([^/?#]+)/.exec(next);

  return match ? decodeURIComponent(match[1]) : undefined;
}
