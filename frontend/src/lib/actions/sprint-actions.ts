"use server";

import { revalidatePath } from "next/cache";
import { revalidateBacklog } from "@/lib/actions/revalidate-backlog";
import { completeSprint, createSprint, deleteSprint, startSprint, updateSprint } from "@/lib/sprints";
import type { ProjectSprintInput } from "@/types/project-sprint";

/*
 * Every sprint write — `backend/docs/api/sprint.md`. Thin by rule: call
 * `lib/sprints.ts`, revalidate, return a code the dialog renders.
 *
 * Both planning routes are revalidated — `/board/sprint-planning` and the
 * project-scoped one — plus `/board/sprints`, which is where a sprint goes
 * once it is completed, and the backlog, because completing or deleting a
 * sprint returns tasks to it. **Permissions are not checked here**; the API's
 * `requireProjectWrite` enforces them.
 *
 * (This file used to hold fixture actions over `lib/sprint.ts`'s demo boards.
 * Nothing called them; they are replaced rather than kept beside the real ones.)
 */

export type SprintActionResult = { code?: string; message?: string };

function revalidatePlanning(workspaceId: string, projectId: string) {
  revalidatePath("/board/sprint-planning");
  revalidatePath(`/workspaces/${workspaceId}/projects/${projectId}/sprint-planning`);
  /* The archive. Completing a sprint is exactly the write that moves a row
     onto it, so a stale cache here would hide the sprint that just closed. */
  revalidatePath("/board/sprints");
  revalidateBacklog(workspaceId, projectId);
}

/** `""` from a form field is "not set", which the API spells `null`. */
function clean(input: ProjectSprintInput): ProjectSprintInput {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value === "" ? null : value]),
  ) as ProjectSprintInput;
}

export async function createSprintAction(
  workspaceId: string,
  projectId: string,
  input: ProjectSprintInput,
): Promise<SprintActionResult> {
  const response = await createSprint(projectId, clean(input));
  if (!response.ok) return { code: response.code };

  revalidatePlanning(workspaceId, projectId);
  return { message: `${response.data.sprint.name} created.` };
}

export async function updateSprintAction(
  workspaceId: string,
  projectId: string,
  sprintId: string,
  patch: ProjectSprintInput,
): Promise<SprintActionResult> {
  const response = await updateSprint(sprintId, clean(patch));
  if (!response.ok) return { code: response.code };

  revalidatePlanning(workspaceId, projectId);
  return { message: `${response.data.sprint.name} updated.` };
}

export async function startSprintAction(
  workspaceId: string,
  projectId: string,
  sprintId: string,
  details: ProjectSprintInput,
): Promise<SprintActionResult> {
  const response = await startSprint(sprintId, clean(details));
  if (!response.ok) return { code: response.code };

  revalidatePlanning(workspaceId, projectId);
  return { message: `${response.data.sprint.name} started.` };
}

export async function completeSprintAction(
  workspaceId: string,
  projectId: string,
  sprintId: string,
): Promise<SprintActionResult> {
  const response = await completeSprint(sprintId);
  if (!response.ok) return { code: response.code };

  revalidatePlanning(workspaceId, projectId);
  const { sprint, completed, returned } = response.data;
  return {
    message: `${sprint.name} completed — ${completed} done, ${returned} returned to the backlog.`,
  };
}

export async function deleteSprintAction(
  workspaceId: string,
  projectId: string,
  sprintId: string,
): Promise<SprintActionResult> {
  const response = await deleteSprint(sprintId);
  if (!response.ok) return { code: response.code };

  revalidatePlanning(workspaceId, projectId);
  const { returned } = response.data;
  return { message: `Sprint deleted${returned > 0 ? ` — ${returned} tasks returned to the backlog` : ""}.` };
}
