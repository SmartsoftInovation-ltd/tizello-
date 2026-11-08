"use server";

import { revalidatePath } from "next/cache";
import {
  createWorkspace,
  deleteWorkspace,
  setWorkspaceArchived,
  updateWorkspace,
} from "@/lib/workspaces";
import type { WorkspaceFormState } from "@/types/workspace";

/*
 * Every workspace write. Thin by rule: validate, call a plain function from
 * `lib/workspaces.ts`, revalidate. The rules themselves live on the server —
 * see `backend/docs/api/workspace.md`.
 *
 * Plain arguments, not `(prevState, formData)` — these are called from
 * `useTransition` event handlers, the same shape as `inviteMemberAction`, not
 * from a `<form action>`. That is what lets a dialog branch on the result and
 * close itself synchronously in the handler instead of watching for success in
 * a `useEffect`, which would trip `react-hooks/set-state-in-effect` the moment
 * it called the parent's `onOpenChange`.
 *
 * **Permissions are not checked here.** `canUpdateWorkspace` / `canDeleteWorkspace`
 * in `lib/roles.ts` decide which controls are drawn; the API's
 * `requirePermission` is what actually enforces them, and its `403` arrives
 * back as `code: "FORBIDDEN"`.
 */

const NAME_MIN = 2;
const NAME_MAX = 80;
const DESCRIPTION_MAX = 500;

/** Both write paths run the same length rule, so neither can drift from the API's Joi schema alone. */
function nameError(name: string): string | undefined {
  return name.length < NAME_MIN || name.length > NAME_MAX
    ? `Must be ${NAME_MIN}–${NAME_MAX} characters.`
    : undefined;
}

/**
 * Both routes that render a workspace, after any write that can change what
 * either shows. The list is revalidated even for a detail-page edit: the name
 * and colour on the card come from the same row.
 */
function revalidateWorkspace(workspaceId: string) {
  revalidatePath("/workspaces");
  revalidatePath(`/workspaces/${workspaceId}`);
}

/** `POST /workspaces`. Re-validates `name`'s length even though the dialog's `TextField` already does — the client-side rule is a convenience, this is the control. */
export async function createWorkspaceAction(input: {
  name: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
  color?: string;
}): Promise<WorkspaceFormState> {
  const name = input.name.trim();
  const description = input.description?.trim();

  const invalid = nameError(name);
  if (invalid) return { fieldErrors: { name: invalid } };

  /* Every optional field is omitted rather than sent empty: the API validates
     `description` as 1–500 chars when present, so `""` is a 400, not a clear. */
  const result = await createWorkspace({
    name,
    ...(description ? { description } : {}),
    ...(input.icon ? { icon: input.icon } : {}),
    ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
    ...(input.color ? { color: input.color } : {}),
  });

  if (!result.ok) {
    return { code: result.code, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/workspaces");
  return { done: true };
}

/**
 * `PATCH /workspaces/:id`.
 *
 * Only fields the caller actually passed are forwarded, and an empty patch is
 * rejected here rather than sent: the API answers `{}` with a `400`, and
 * "Provide at least one field to update" is not a sentence to show someone who
 * pressed Save without changing anything. The dialog diffs against the row it
 * was opened with, so this is the second line of defence, not the first.
 *
 * `description` / `icon` / `color` are nullable on purpose — `null` is how the
 * API clears a value, and it has to survive the trip as `null` rather than
 * being dropped as falsy.
 */
export async function updateWorkspaceAction(
  workspaceId: string,
  patch: {
    name?: string;
    description?: string | null;
    icon?: string | null;
    imageUrl?: string | null;
    color?: string | null;
  },
): Promise<WorkspaceFormState> {
  const next: typeof patch = {};

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    const invalid = nameError(name);
    if (invalid) return { fieldErrors: { name: invalid } };
    next.name = name;
  }

  if (patch.description !== undefined) {
    const description = patch.description?.trim() ?? "";
    if (description.length > DESCRIPTION_MAX) {
      return { fieldErrors: { description: `Must be ${DESCRIPTION_MAX} characters or fewer.` } };
    }
    next.description = description === "" ? null : description;
  }

  if (patch.icon !== undefined) next.icon = patch.icon || null;
  if (patch.imageUrl !== undefined) next.imageUrl = patch.imageUrl || null;
  if (patch.color !== undefined) next.color = patch.color || null;

  if (Object.keys(next).length === 0) return { done: true };

  const result = await updateWorkspace(workspaceId, next);
  if (!result.ok) return { code: result.code, fieldErrors: result.fieldErrors };

  revalidateWorkspace(workspaceId);
  return { done: true };
}

/**
 * `PATCH /workspaces/:id/archive` — the reversible half of feature 4.
 *
 * Archiving hides the workspace from the default list rather than removing
 * anything; `isArchived: false` brings it straight back, which is why one
 * action serves both directions instead of an archive/restore pair.
 */
export async function setWorkspaceArchivedAction(
  workspaceId: string,
  isArchived: boolean,
): Promise<WorkspaceFormState> {
  const result = await setWorkspaceArchived(workspaceId, isArchived);
  if (!result.ok) return { code: result.code };

  revalidateWorkspace(workspaceId);
  return { done: true };
}

/**
 * `DELETE /workspaces/:id` — the irreversible half.
 *
 * Soft on the server (`deletedAt` is stamped, the row survives for a purge job
 * that does not exist yet) but **permanent from this app**: every read in
 * `workspace.repository.js` filters `deletedAt: null` unconditionally, so
 * nothing here can ever fetch it again. The dialog says so in those terms
 * rather than promising a restore no screen can perform.
 */
export async function deleteWorkspaceAction(
  workspaceId: string,
): Promise<WorkspaceFormState> {
  const result = await deleteWorkspace(workspaceId);
  if (!result.ok) return { code: result.code };

  revalidateWorkspace(workspaceId);
  return { done: true };
}
