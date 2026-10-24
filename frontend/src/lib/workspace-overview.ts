import { apiCallWithRefresh } from "@/lib/api-client";
import type { ProjectStatus } from "@/types/project";
import type { TaskStatusGroup } from "@/types/task";

/*
 * `GET /workspaces/overview` — the numbers behind the `/workspaces` dashboard
 * (`backend/docs/api/workspace.md` §Overview). One request, aggregated in SQL;
 * every status and group arrives with a zero, so nothing here guesses.
 *
 * `null` on failure rather than throwing: the dashboard is a summary above the
 * workspace list, and an API hiccup must cost the summary, never the list.
 */
export type WorkspaceOverviewRow = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  members: number;
  activeSprints: number;
  projects: Record<ProjectStatus, number>;
  projectCount: number;
  tasks: Record<TaskStatusGroup, number>;
  overdue: number;
  openPoints: number;
};

export type WorkspaceOverview = {
  totals: {
    workspaces: number;
    projects: number;
    openTasks: number;
    doneTasks: number;
    overdueTasks: number;
    activeSprints: number;
  };
  projectsByStatus: Record<ProjectStatus, number>;
  workspaces: WorkspaceOverviewRow[];
};

export async function getWorkspaceOverview(): Promise<WorkspaceOverview | null> {
  const result = await apiCallWithRefresh<WorkspaceOverview>("/workspaces/overview");

  return result.ok ? result.data : null;
}
