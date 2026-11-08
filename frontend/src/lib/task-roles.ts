import { hasWorkspacePermission, PERMISSION } from "@/lib/roles";
import type { ProjectRole } from "@/types/project";
import type { Workspace } from "@/types/workspace";

/*
 * What a caller may do to a project's TASKS — a mirror of `canContribute` in
 * `backend/src/shared/services/project-access.js` (`requireProjectContribute`),
 * and only ever a mirror: it decides which controls are drawn, the API decides
 * what is allowed.
 *
 * Wider than `canWriteProject` on purpose. Editing a PROJECT is its owner's and
 * managers' business; working its TASKS — creating, editing, dragging a card
 * across the backlog, planning or the sprint board — is open to:
 *
 *   - workspace OWNER/ADMIN (the escape hatch),
 *   - anyone on the project (`viewerRole` not `null`),
 *   - anyone whose workspace role holds `tasks.work` — every MEMBER by
 *     default, so members can move cards without being added to each project.
 *
 * A custom role without `tasks.work` keeps the old rule: read-only on projects
 * they are not on. Adding a task COLUMN stays with `canWriteProject`, because a
 * column changes every task in the project.
 */
export function canContributeToProject(
  workspace: Pick<Workspace, "role" | "permissions">,
  viewerRole: ProjectRole | null,
): boolean {
  return (
    workspace.role === "OWNER" ||
    workspace.role === "ADMIN" ||
    viewerRole !== null ||
    hasWorkspacePermission(workspace, PERMISSION.TASK_WORK_ANY)
  );
}
