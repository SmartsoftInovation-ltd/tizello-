"use server";

import type { ProjectScope } from "@/components/projects/project-properties";
import { getSession } from "@/lib/auth";
import { getProjectPropertyDefs } from "@/lib/project-property-defs";
import { canCreateProject, canManageProperties } from "@/lib/project-roles";
import { todayIso } from "@/lib/today";
import { getWorkspace, getWorkspaceMembers } from "@/lib/workspaces";

/*
 * Everything the create-project drawer needs, for a caller that is not a page.
 *
 * The projects page builds this `ProjectScope` on the server and passes it to
 * every "+ New project" trigger. The sidebar's `+` lives in the app shell —
 * a client component rendered on every route — so it has no page to hand it a
 * scope, and fetching the schema and roster on every navigation just in case
 * someone presses `+` would be four requests per page for a rare click. It
 * asks here instead, on click.
 *
 * A Server Action rather than a fetch from the browser: the API cookie is
 * `httpOnly` and same-origin, so the browser has no credential to call the
 * API with. `null` means "cannot create here" — not signed in, not a member,
 * or a role without `PROJECT_CREATE` — and the button says so instead of
 * opening a drawer whose Create would fail. The API still enforces it.
 */
export async function loadProjectScopeAction(workspaceId: string): Promise<ProjectScope | null> {
  const [user, workspace, definitions, workspaceMembers] = await Promise.all([
    getSession(),
    getWorkspace(workspaceId),
    getProjectPropertyDefs(workspaceId),
    getWorkspaceMembers(workspaceId),
  ]);

  if (!user || !workspace || !canCreateProject(workspace.role)) return null;

  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    today: todayIso(),
    definitions,
    canManageProperties: canManageProperties(workspace.role),
    currentUserId: user.id,
    workspaceMembers,
  };
}
