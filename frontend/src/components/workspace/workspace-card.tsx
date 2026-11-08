import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleBadge } from "@/components/workspace/role-badge";
import { WorkspaceActionsMenu } from "@/components/workspace/workspace-actions-menu";
import { WorkspaceAvatar } from "@/components/workspace/workspace-avatar";
import { plural } from "@/lib/plural";
import type { Workspace } from "@/types/workspace";

/**
 * The whole card is one hit target, but it is NOT one `<a>` any more: the
 * actions menu in the corner is a `<button>`, and a button inside an anchor is
 * invalid HTML that browsers resolve by dropping one of them. The title carries
 * the link and `after:absolute after:inset-0` stretches its hit area over the
 * card; the menu sits above that overlay on its own stacking context. Focus
 * lands on the title and on the menu — two stops, both visible — rather than on
 * one anchor wrapping everything.
 *
 * `memberCount` / `projects` are fixture-only (see types/workspace.ts) — a
 * real, API-sourced workspace has neither, so the footer falls back to the
 * description and the meta line to the slug rather than rendering "undefined
 * projects".
 */
export function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  const {
    id,
    name,
    slug,
    icon,
    imageUrl,
    color,
    memberCount,
    role,
    accent,
    projects,
    isArchived,
  } = workspace;
  const tasks = projects?.reduce(
    (total, project) => total + project.taskCount,
    0,
  );

  return (
    <Card className="hover-lift h-full">
      <CardHeader className="gap-3">
        <div className="flex items-start gap-3">
          <WorkspaceAvatar
            name={name}
            icon={icon}
            imageUrl={imageUrl}
            color={color}
            accent={accent}
          />

          <div className="min-w-0 flex-1">
            <CardTitle className="line-clamp-2 break-words">
              <Link
                href={`/workspaces/${id}`}
                className="rounded-xs after:absolute after:inset-0 after:rounded-md"
              >
                {name}
              </Link>
            </CardTitle>
            <p className="mt-0.5 truncate text-2xs text-text-subtle">
              {memberCount !== undefined
                ? plural(memberCount, "member", "members")
                : `@${slug}`}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {/* Both chips on one row, and both through `Badge` — the archived
                one used to be a hand-rolled span with its own padding and
                weight, which is why the two never lined up: different box, same
                position. One primitive owns the geometry now. */}
            {isArchived && <Badge>Archived</Badge>}
            {role === "OWNER" && <RoleBadge role={role} />}

            {/* Above the stretched link, so the trigger takes its own clicks
                and the rest of the card still navigates. */}
            <div className="relative z-10">
              <WorkspaceActionsMenu workspace={workspace} showOpenLink />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardFooter>
        <p className="truncate text-2xs text-text-subtle">
          {projects
            ? `${plural(projects.length, "project", "projects")} · ${plural(tasks ?? 0, "task", "tasks")}`
            : (workspace.description ?? "No description yet")}
        </p>
      </CardFooter>
    </Card>
  );
}
