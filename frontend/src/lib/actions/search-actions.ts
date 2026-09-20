"use server";

import { searchEverything } from "@/lib/search";
import type { SearchResults } from "@/types/search";

/*
 * Search is READ through a Server Action, the way task comments are
 * (`task-actions.ts`), and for a related reason: the query does not exist
 * until someone types it, so there is nothing a Server Component could fetch
 * ahead of time.
 *
 * It is an action rather than a `fetch` from the browser because the access
 * token lives in an httpOnly cookie the client cannot read, and
 * `apiCallWithRefresh` is what renews a lapsed one. Calling the API directly
 * from the palette would mean either exposing the token or re-implementing
 * refresh in the browser.
 *
 * NOTHING IS REVALIDATED — this writes nothing. An action that calls
 * `revalidatePath` on a keystroke would re-render the page behind the palette
 * while someone is typing into it.
 */
export async function searchAction(query: string): Promise<SearchResults> {
  return searchEverything(query);
}
