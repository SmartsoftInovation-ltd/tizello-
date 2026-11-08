import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/workspace/role-badge";
import { WorkspaceAvatar } from "@/components/workspace/workspace-avatar";
import { WorkspaceDetailActions } from "@/components/workspace/workspace-detail-actions";
import { WorkspaceSwitchMenu } from "@/components/workspace/workspace-switch-menu";
import type { Workspace } from "@/types/workspace";

/**
 * The identity block on the workspace detail page: who this workspace is, what
 * the reader may do to it, and the way out to another one.
 *
 * A Server Component. The two controls on the right are the only client leaves
 * — a dropdown each — and neither pulls the header into the browser bundle.
 *
 * `memberCount` is deliberately gone from this header. It was fixture-only
 * (types/workspace.ts), and an API-sourced workspace has no member aggregate to
 * read, so the line under the name is the slug — a real value that is always
 * there — rather than a member count that would have to render as zero.
 */
export function WorkspaceDetailHeader({
  workspace,
  workspaces,
}: {
  workspace: Workspace;
  workspaces: Workspace[];
}) {
  return (
    <header>
      {/* No back link: the content strip's breadcrumb (Home › Overview) is the way out. */}
      <div className="flex items-start gap-3">
        <WorkspaceAvatar
          name={workspace.name}
          icon={workspace.icon}
          imageUrl={workspace.imageUrl}
          color={workspace.color}
          accent={workspace.accent}
          size="lg"
          className="mt-0.5"
        />

        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight break-words text-text">
            {workspace.name}
          </h1>

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <p className="truncate text-sm text-text-muted">@{workspace.slug}</p>
            <RoleBadge role={workspace.role} />
            {workspace.isArchived && <Badge variant="warning">Archived</Badge>}
          </div>

          {workspace.description && (
            <p className="mt-3 max-w-prose text-sm text-text-muted">
              {workspace.description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <WorkspaceSwitchMenu
            workspaces={workspaces}
            currentWorkspaceId={workspace.id}
          />
          <WorkspaceDetailActions workspace={workspace} />
        </div>
      </div>
    </header>
  );
}
