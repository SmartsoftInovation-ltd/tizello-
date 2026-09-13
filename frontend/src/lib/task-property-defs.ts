import { apiCallWithRefresh } from "@/lib/api-client";
import { fieldErrorsFrom } from "@/lib/field-errors";
import type { ActionResult } from "@/lib/workspaces";
import type { PropertyOption, PropertyType } from "@/types/project-property";
import type { TaskPropertyDef } from "@/types/task";

/*
 * A project's TASK-property schema — `backend/docs/api/task.md` §*Task
 * properties*. The per-project twin of `lib/project-property-defs.ts`.
 *
 * Definitions only. Values ride `PATCH /tasks/:id` as one more field, for the
 * same reason project values ride `PATCH /projects/:id`: saving a task should
 * be one request that cannot half-fail.
 *
 * Writes are project-writer-only on the server (owner, MANAGER, workspace
 * OWNER/ADMIN). A collaborator may fill a column in, not invent one.
 */

const base = (projectId: string) =>
  `/projects/${encodeURIComponent(projectId)}/task-properties`;

/** `GET /projects/:projectId/task-properties`, ordered by position. */
export async function getTaskPropertyDefs(projectId: string): Promise<TaskPropertyDef[]> {
  const result = await apiCallWithRefresh<{ properties: TaskPropertyDef[] }>(base(projectId));

  return result.ok ? result.data.properties : [];
}

/** `POST /projects/:projectId/task-properties`. `options` only for the two select types. */
export async function createTaskPropertyDef(
  projectId: string,
  input: { name: string; type: PropertyType; options?: PropertyOption[] },
): Promise<ActionResult<TaskPropertyDef>> {
  const result = await apiCallWithRefresh<{ property: TaskPropertyDef }>(base(projectId), {
    method: "POST",
    body: input,
  });

  if (!result.ok) {
    return { ok: false, code: result.code, fieldErrors: fieldErrorsFrom(result.details) };
  }

  return { ok: true, data: result.data.property };
}

/** `DELETE .../task-properties/:id`. Orphans the stored values rather than rewriting every task. */
export async function deleteTaskPropertyDef(
  projectId: string,
  propertyId: string,
): Promise<ActionResult> {
  const result = await apiCallWithRefresh(
    `${base(projectId)}/${encodeURIComponent(propertyId)}`,
    { method: "DELETE" },
  );

  return result.ok ? { ok: true, data: undefined } : { ok: false, code: result.code };
}
