import type { ProjectRole } from "@/types/project";
import type { WorkspaceRole } from "@/types/workspace";

/*
 * What a caller may do to a project's TASKS — a mirror of
 * `requireProjectContribute` in `backend/src/shared/middlewares/task.js`, and
 * only ever a mirror: it decides which controls are drawn, the API decides
 * what is allowed.
 *
 * Wider than `canWriteProject` on purpose. Editing a PROJECT is its owner's and
 * managers' business; working its TASKS is what a collaborator is on the
 * project to do. A workspace MEMBER who is not on the project (`viewerRole`
 * `null`) can read the backlog and change nothing. Adding a task COLUMN stays
 * with `canWriteProject`, because a column changes every task in the project.
 */
export function canContributeToProject(
  workspaceRole: WorkspaceRole,
  viewerRole: ProjectRole | null,
): boolean {
  return workspaceRole === "OWNER" || workspaceRole === "ADMIN" || viewerRole !== null;
}
