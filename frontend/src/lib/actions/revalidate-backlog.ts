import { revalidatePath } from "next/cache";

/**
 * Every route that draws a project's tasks by container — the sidebar's
 * `/board/backlog` and `/board/sprint-planning`, and their project-scoped
 * twins. One task write can move a row between the backlog and a sprint, so
 * both screens are refreshed together rather than each action guessing which.
 *
 * Its own module, not a function inside an action file, because a `"use server"`
 * file may export only async actions and several action files need this.
 */
export function revalidateBacklog(workspaceId: string, projectId: string) {
  revalidatePath("/board/backlog");
  revalidatePath("/board/sprint-planning");
  revalidatePath(`/workspaces/${workspaceId}/projects/${projectId}/backlog`);
  revalidatePath(`/workspaces/${workspaceId}/projects/${projectId}/sprint-planning`);
}
