"use server";

import { revalidatePath } from "next/cache";
import {
  createTaskPropertyDef,
  deleteTaskPropertyDef,
} from "@/lib/task-property-defs";
import type { PropertyType } from "@/types/project-property";
import type { TaskPropertyDef } from "@/types/task";

/*
 * Writes to a project's TASK-property schema. They land IMMEDIATELY rather than
 * riding one task's Save — a column belongs to every task in the project, and
 * holding it behind one drawer would make it appear for everyone only when that
 * person finished, and vanish if they cancelled. `project-property-actions.ts`
 * makes the same call for the workspace's project columns.
 */

type TaskPropertyFormState = {
  code?: string;
  fieldErrors?: Record<string, string>;
  property?: TaskPropertyDef;
};

function revalidateBacklog(workspaceId: string, projectId: string) {
  revalidatePath("/board/backlog");
  revalidatePath(`/workspaces/${workspaceId}/projects/${projectId}/backlog`);
}

export async function createTaskPropertyDefAction(
  workspaceId: string,
  projectId: string,
  input: { name: string; type: PropertyType },
): Promise<TaskPropertyFormState> {
  const name = input.name.trim();
  if (!name) return { fieldErrors: { name: "Give the property a name." } };

  const result = await createTaskPropertyDef(projectId, { name, type: input.type });
  if (!result.ok) return { code: result.code, fieldErrors: result.fieldErrors };

  revalidateBacklog(workspaceId, projectId);
  return { property: result.data };
}

export async function deleteTaskPropertyDefAction(
  workspaceId: string,
  projectId: string,
  propertyId: string,
): Promise<TaskPropertyFormState> {
  const result = await deleteTaskPropertyDef(projectId, propertyId);
  if (!result.ok) return { code: result.code };

  revalidateBacklog(workspaceId, projectId);
  return {};
}
