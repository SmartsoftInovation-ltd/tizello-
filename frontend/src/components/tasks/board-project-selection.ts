import { cookies } from "next/headers";
import type { PickerGroup } from "@/components/tasks/backlog-project-picker";
import { workspaceFromCookies } from "@/lib/active-workspace";
import { getWorkspaceProjects } from "@/lib/projects";
import { getWorkspaces } from "@/lib/workspaces";
import type { ProjectRecord } from "@/types/project";
import type { Workspace } from "@/types/workspace";

/**
 * Which project a sidebar board screen (`/board/backlog`, `/board/sprint-planning`)
 * shows, and the grouped list its project picker offers.
 *
 * The sidebar has no project to pass, so the project comes from `?project=`,
 * then falls back to the first project of the workspace the user last had open
 * (so the screen agrees with the sidebar switcher), then to the first project
 * they can see at all. Every workspace's project list is read in parallel — one
 * request per workspace, and people belong to a handful.
 *
 * Shared so the two screens cannot pick different projects for the same URL
 * and cookie. Server-only: it reads cookies and calls the API.
 */
export type ProjectEntry = { workspace: Workspace; project: ProjectRecord };

export async function boardProjectSelection(requested: string | string[] | undefined): Promise<{
  selected: ProjectEntry | undefined;
  /** Set only when `?project=` named a project — the one case that updates the remembered workspace. */
  requestedEntry: ProjectEntry | undefined;
  groups: PickerGroup[];
}> {
  const workspaces = await getWorkspaces();
  const lists = await Promise.all(
    workspaces.map(async (workspace) => ({ workspace, projects: await getWorkspaceProjects(workspace.id) })),
  );

  const entries = lists.flatMap(({ workspace, projects }) => projects.map((project) => ({ workspace, project })));
  const storedWorkspaceId = workspaceFromCookies((await cookies()).toString());
  const requestedEntry = entries.find(({ project }) => project.id === requested);
  const selected =
    requestedEntry ?? entries.find(({ workspace }) => workspace.id === storedWorkspaceId) ?? entries[0];

  const groups: PickerGroup[] = lists
    .filter(({ projects }) => projects.length > 0)
    .map(({ workspace, projects }) => ({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        icon: workspace.icon,
        color: workspace.color,
        accent: workspace.accent,
      },
      projects: projects.map(({ id, key, name, icon, color }) => ({ id, key, name, icon, color })),
    }));

  return { selected, requestedEntry, groups };
}
