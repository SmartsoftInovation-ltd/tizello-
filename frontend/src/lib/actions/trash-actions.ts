"use server";

import { revalidatePath } from "next/cache";
import { purgeEntry, restoreEntry } from "@/lib/trash";

/*
 * The trash's two writes.
 *
 * BOTH REVALIDATE `/trash` AND THE PLACE THE ITEM CAME BACK TO. A restore that
 * refreshed only the bin would leave the reader looking at a list the row has
 * left, with the project still missing from `/workspaces` until they reloaded
 * by hand — the write would look like it had half worked.
 *
 * `layout` rather than `page` for the workspace paths: a restored project
 * changes the sidebar's project list too, and that is rendered by the layout.
 */
export async function restoreTrashEntryAction(kind: "project" | "task", id: string) {
  const result = await restoreEntry(kind, id);

  if (result.ok) {
    revalidatePath("/trash");
    revalidatePath("/workspaces", "layout");
    revalidatePath("/board", "layout");
  }

  return result.ok ? { ok: true as const } : { ok: false as const, code: result.code };
}

export async function purgeTrashEntryAction(kind: "project" | "task", id: string) {
  const result = await purgeEntry(kind, id);

  /* Only `/trash` — a purged row was already invisible everywhere else, so
     there is nothing elsewhere to bring up to date. */
  if (result.ok) revalidatePath("/trash");

  return result.ok ? { ok: true as const } : { ok: false as const, code: result.code };
}
