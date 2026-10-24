import { cookies } from "next/headers";
import type { PickerGroup } from "@/components/tasks/backlog-project-picker";
import { workspaceFromCookies } from "@/lib/active-workspace";
import { getWorkspaceProjects } from "@/lib/projects";
import { getWorkspaces } from "@/lib/workspaces";
import type { ProjectRecord } from "@/types/project";
import type { Workspace } from "@/types/workspace";

/**
 * Which project a sidebar board screen (`/board/backlog`, `/board/sprint-planning`,
 * `/board/sprints`, `/board/sprint/breakdown`) shows, and the list its project
 * picker offers.
 *
 * ONE WORKSPACE AT A TIME. The picker lists only the projects of the workspace
 * the user is in — the one they last had open (the `active-workspace` cookie
 * the sidebar switcher writes). It used to group every workspace's projects,
 * so someone working in Tizaraa was offered Daiki's and Revenco's too, and one
 * click filed their work into the wrong team. Changing workspace is the
 * sidebar switcher's job, not this dropdown's.
 *
 * Resolution:
 *   1. `?project=` names a project → that project, and ITS workspace becomes
 *      the scope (the page then remembers it — `RememberWorkspace`). Finding
 *      it needs every workspace's list, so only this path reads them all.
 *   2. Otherwise the remembered workspace's first project — one request.
 *   3. If that workspace is unknown or has no projects, the first workspace
 *      that has any, so the screen is never empty while something exists.
 *
 * Shared so the screens cannot pick different projects for the same URL and
 * cookie. Server-only: it reads cookies and calls the API.
 */
export type ProjectEntry = { workspace: Workspace; project: ProjectRecord };

type WorkspaceList = { workspace: Workspace; projects: ProjectRecord[] };

const listFor = async (workspace: Workspace): Promise<WorkspaceList> => ({
  workspace,
  projects: await getWorkspaceProjects(workspace.id),
});

export async function boardProjectSelection(requested: string | string[] | undefined): Promise<{
  selected: ProjectEntry | undefined;
  /** Set only when `?project=` named a project — the one case that updates the remembered workspace. */
  requestedEntry: ProjectEntry | undefined;
  groups: PickerGroup[];
}> {
  const workspaces = await getWorkspaces();
  const storedWorkspaceId = workspaceFromCookies((await cookies()).toString());
  const stored = workspaces.find((workspace) => workspace.id === storedWorkspaceId);

  let scope: WorkspaceList | undefined;
  let requestedEntry: ProjectEntry | undefined;

  if (typeof requested === "string" && requested) {
    const lists = await Promise.all(workspaces.map(listFor));
    const owner = lists.find(({ projects }) => projects.some((project) => project.id === requested));
    if (owner) {
      scope = owner;
      requestedEntry = {
        workspace: owner.workspace,
        project: owner.projects.find((project) => project.id === requested)!,
      };
    } else {
      scope = lists.find(({ workspace }) => workspace.id === stored?.id);
      if (!scope?.projects.length) scope = lists.find(({ projects }) => projects.length > 0);
    }
  } else {
    scope = stored ? await listFor(stored) : undefined;
    if (!scope?.projects.length) {
      const others = await Promise.all(workspaces.filter((workspace) => workspace.id !== stored?.id).map(listFor));
      scope = others.find(({ projects }) => projects.length > 0) ?? scope;
    }
  }

  const selected =
    requestedEntry ?? (scope?.projects[0] ? { workspace: scope.workspace, project: scope.projects[0] } : undefined);

  const groups: PickerGroup[] =
    scope && scope.projects.length > 0
      ? [
          {
            workspace: {
              id: scope.workspace.id,
              name: scope.workspace.name,
              icon: scope.workspace.icon,
              color: scope.workspace.color,
              accent: scope.workspace.accent,
            },
            projects: scope.projects.map(({ id, key, name, icon, color }) => ({ id, key, name, icon, color })),
          },
        ]
      : [];

  return { selected, requestedEntry, groups };
}
