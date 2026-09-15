import { apiCallWithRefresh } from "@/lib/api-client";
import type { ActionResult } from "@/lib/workspaces";
import type { ProjectSprint, ProjectSprintInput } from "@/types/project-sprint";

/*
 * The sprint API — `backend/docs/api/sprint.md`.
 *
 * TWO PREFIXES, like tasks: create and list carry the PROJECT in the path;
 * everything else is addressed by the sprint's own id. Every call goes through
 * `apiCallWithRefresh`. Moving a task INTO a sprint is not here — it is a task
 * move (`lib/task-bulk.ts`), because it is the task that changes.
 */

const sprintPath = (sprintId: string) => `/sprints/${encodeURIComponent(sprintId)}`;

function result<T>(response: Awaited<ReturnType<typeof apiCallWithRefresh<T>>>): ActionResult<T> {
  return response.ok ? { ok: true, data: response.data } : { ok: false, code: response.code };
}

/** `GET /projects/:projectId/sprints` — active first, then planning by number, then history. */
export async function getSprints(projectId: string): Promise<ProjectSprint[]> {
  const response = await apiCallWithRefresh<{ sprints: ProjectSprint[] }>(
    `/projects/${encodeURIComponent(projectId)}/sprints`,
  );

  return response.ok ? response.data.sprints : [];
}

export async function createSprint(
  projectId: string,
  input: ProjectSprintInput,
): Promise<ActionResult<{ sprint: ProjectSprint }>> {
  return result(
    await apiCallWithRefresh<{ sprint: ProjectSprint }>(`/projects/${encodeURIComponent(projectId)}/sprints`, {
      method: "POST",
      body: input,
    }),
  );
}

export async function updateSprint(
  sprintId: string,
  patch: ProjectSprintInput,
): Promise<ActionResult<{ sprint: ProjectSprint }>> {
  return result(await apiCallWithRefresh<{ sprint: ProjectSprint }>(sprintPath(sprintId), { method: "PATCH", body: patch }));
}

/** Refused (`409`) while another sprint is active, (`422`) without both dates. */
export async function startSprint(
  sprintId: string,
  details: ProjectSprintInput,
): Promise<ActionResult<{ sprint: ProjectSprint }>> {
  return result(
    await apiCallWithRefresh<{ sprint: ProjectSprint }>(`${sprintPath(sprintId)}/start`, { method: "POST", body: details }),
  );
}

/** Unfinished tasks return to the backlog; done ones stay as the sprint's record. */
export async function completeSprint(
  sprintId: string,
): Promise<ActionResult<{ sprint: ProjectSprint; completed: number; returned: number }>> {
  return result(
    await apiCallWithRefresh<{ sprint: ProjectSprint; completed: number; returned: number }>(
      `${sprintPath(sprintId)}/complete`,
      { method: "POST" },
    ),
  );
}

/** PLANNING sprints only; its tasks return to the backlog. */
export async function deleteSprint(sprintId: string): Promise<ActionResult<{ returned: number }>> {
  return result(await apiCallWithRefresh<{ returned: number }>(sprintPath(sprintId), { method: "DELETE" }));
}
