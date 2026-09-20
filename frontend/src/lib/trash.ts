import { apiCallWithRefresh } from "@/lib/api-client";
import type { ActionResult } from "@/lib/workspaces";
import { EMPTY_TRASH, type Trash } from "@/types/trash";

/*
 * The trash API — `backend/docs/api/trash.md`.
 *
 * NO ID IN THE PATH BEYOND THE ENTRY'S OWN, like `lib/search.ts`: the trash is
 * not a place inside a workspace or a project, it is everything of yours that
 * is gone. Scope comes from the session.
 *
 * RESTORE IS `POST`, PURGE IS `DELETE`, and the asymmetry is the point — this
 * is the one place in the API where `DELETE` really destroys the row rather
 * than stamping `deletedAt`. Everywhere else the verb promises the data is
 * recoverable; here it promises it is not.
 */

export async function getTrash(): Promise<Trash> {
  const result = await apiCallWithRefresh<Trash>("/trash?limit=100");

  return result.ok ? result.data : EMPTY_TRASH;
}

/* Both writes WAIT for the server rather than being optimistic. A restore that
   drew itself as done and then failed would leave the reader believing their
   work is back; a purge that did is worse. The row stays put until the API
   agrees, which is also what lets a 403 land while the button is still under
   the cursor. */

export async function restoreEntry(kind: "project" | "task", id: string): Promise<ActionResult<unknown>> {
  const result = await apiCallWithRefresh<unknown>(`/trash/${kind}s/${encodeURIComponent(id)}/restore`, {
    method: "POST",
  });

  return result.ok ? { ok: true, data: result.data } : { ok: false, code: result.code };
}

export async function purgeEntry(kind: "project" | "task", id: string): Promise<ActionResult<unknown>> {
  const result = await apiCallWithRefresh<unknown>(`/trash/${kind}s/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  return result.ok ? { ok: true, data: result.data } : { ok: false, code: result.code };
}
