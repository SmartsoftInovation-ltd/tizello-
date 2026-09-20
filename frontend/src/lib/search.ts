import { apiCallWithRefresh } from "@/lib/api-client";
import { EMPTY_RESULTS, SEARCH_MIN_LENGTH, type SearchResults } from "@/types/search";

/*
 * The search API — `backend/docs/api/search.md`.
 *
 * ONE CALL, NO PREFIX GYMNASTICS, unlike `lib/tasks.ts` and `lib/projects.ts`:
 * search addresses nothing, so there is no id in the path. Its scope is every
 * workspace the caller belongs to, resolved server-side from the session —
 * which is also why there is no `workspaceId` argument to forget to pass.
 *
 * THE MINIMUM LENGTH IS CHECKED HERE TOO. The server enforces it (a 400), but
 * a type-ahead that fires a request it knows will be refused, on every
 * keystroke, is a request loop wearing a validation rule as a hat. Below the
 * floor this returns empty results without touching the network.
 */
export async function searchEverything(query: string, limit = 5): Promise<SearchResults> {
  const q = query.trim();
  if (q.length < SEARCH_MIN_LENGTH) return { ...EMPTY_RESULTS, query: q };

  const params = new URLSearchParams({ q, limit: String(limit) });
  const result = await apiCallWithRefresh<SearchResults>(`/search?${params.toString()}`);

  /* A failed search is an empty one, deliberately: the palette is a shortcut,
     not a destination, and an error panel where a list of results should be
     interrupts the thing the reader was doing. The rate limiter's 429 is the
     one case worth naming, so the caller can say "slow down" rather than
     "nothing found" — hence the code coming back rather than being swallowed. */
  return result.ok ? result.data : { ...EMPTY_RESULTS, query: q };
}
