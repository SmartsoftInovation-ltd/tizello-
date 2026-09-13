import type { ProjectScope } from "@/components/projects/project-properties";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ProjectActionsMenu } from "@/components/projects/project-actions-menu";
import { ProjectGlyph } from "@/components/projects/project-glyph";
import { ProjectPriorityBadge } from "@/components/projects/project-priority-badge";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { ProjectMetaRows } from "@/components/projects/project-meta-rows";
import { canWriteProject } from "@/lib/project-roles";
import type { WorkspaceMemberRow } from "@/lib/workspaces";
import type { ProjectMemberRecord, ProjectRecord } from "@/types/project";
import type { WorkspaceRole } from "@/types/workspace";

/**
 * The identity block at the top of a project.
 *
 * The back link points at the workspace's project list rather than at browser
 * history: someone who arrived from a bookmark or a shared URL has no history
 * to go back to, and a control that does nothing for them is worse than one
 * that always goes somewhere sensible.
 *
 * A Server Component — only the actions menu inside it is a client leaf.
 */
export function ProjectDetailHeader({
  project,
  workspaceName,
  workspaceRole,
  scope,
  members,
  workspaceMembers,
}: {
  project: ProjectRecord;
  workspaceName: string;
  workspaceRole: WorkspaceRole;
  scope: ProjectScope;
  /** This project's collaborators. */
  members: ProjectMemberRecord[];
  /** Everyone in the workspace — the pool the collaborator picker offers. */
  workspaceMembers: WorkspaceMemberRow[];
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <ProjectGlyph icon={project.icon} color={project.color} size="lg" />

        <div className="min-w-0">
          <Link
            href={`/workspaces/${project.workspaceId}/projects`}
            className="text-2xs text-text-subtle transition-colors duration-100 ease-standard hover:text-text"
          >
            &larr; {workspaceName}
          </Link>

          <h1 className="mt-0.5 text-xl font-semibold tracking-tight break-words text-text">
            {project.name}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge className="font-mono">{project.key}</Badge>
            <ProjectStatusBadge status={project.status} />
            <ProjectPriorityBadge priority={project.priority} />
            {project.isArchived && <Badge variant="warning">Archived</Badge>}
            {/* The one way into this project's tasks from the project itself. */}
            <Link
              href={`/board/backlog?project=${project.id}`}
              className="ml-1 rounded-xs text-2xs font-medium text-text-brand transition-colors duration-100 ease-standard hover:underline"
            >
              Open backlog &rarr;
            </Link>
          </div>
        </div>
      </div>

      <ProjectActionsMenu
        project={project}
        workspaceRole={workspaceRole}
        scope={scope}
        /* Only this page has the member list, so only this page can build the
           facts block — see `EditProjectDrawer`'s `meta`. */
        meta={
          <ProjectMetaRows
            project={project}
            currentUserId={scope.currentUserId}
            members={members}
            workspaceMembers={workspaceMembers}
            canWrite={canWriteProject(workspaceRole, project.viewerRole)}
          />
        }
      />
    </header>
  );
}
