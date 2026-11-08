import { RoleBadge } from "@/components/workspace/role-badge";
import type { WorkspaceInvitation } from "@/types/workspace";

/**
 * What is actually being granted, in one block: the workspace, who asked, and
 * the role. A `<dl>` rather than three paragraphs — these are label/value
 * pairs, and the markup should say so.
 *
 * Flat, bordered and sunken, like every other information surface in the app.
 * Nothing here floats, so nothing here has a shadow.
 *
 * Values wrap rather than truncate: a name is not something to hide behind an
 * ellipsis on the one screen where knowing who invited you is the point.
 */
export function InviteSummary({
  invitation,
}: {
  invitation: WorkspaceInvitation;
}) {
  return (
    <dl className="space-y-3 rounded-md border border-border bg-surface-sunken p-4">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="shrink-0 text-xs text-text-subtle">Workspace</dt>
        <dd className="min-w-0 text-right text-sm font-semibold break-words text-text">
          {invitation.workspaceName}
        </dd>
      </div>

      <div className="flex items-baseline justify-between gap-4">
        <dt className="shrink-0 text-xs text-text-subtle">Invited by</dt>
        <dd className="min-w-0 text-right text-sm break-words text-text-muted">
          {invitation.invitedByName}
        </dd>
      </div>

      <div className="flex items-center justify-between gap-4">
        <dt className="shrink-0 text-xs text-text-subtle">Your role</dt>
        <dd className="min-w-0">
          <RoleBadge role={invitation.role} name={invitation.roleName} />
        </dd>
      </div>
    </dl>
  );
}
