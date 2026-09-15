import { revalidatePath } from "next/cache";

/**
 * Both routes that render a backlog — the sidebar's `/board/backlog` and the
 * project-scoped one. Its own module, not a function inside an action file,
 * because a `"use server"` file may export only async actions and two action
 * files need this.
 */
export function revalidateBacklog(workspaceId: string, projectId: string) {
  revalidatePath("/board/backlog");
  revalidatePath(`/workspaces/${workspaceId}/projects/${projectId}/backlog`);
}
