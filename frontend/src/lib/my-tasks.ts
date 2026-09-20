import { apiCallWithRefresh } from "@/lib/api-client";
import type { AssignedTask } from "@/types/task";

/*
 * The "My tasks" read — `GET /tasks/assigned`, `backend/docs/api/task.md` §2a.
 *
 * NO ID IN THE PATH AND NO ID IN THE QUERY, like `lib/search.ts`: the scope is
 * the caller, resolved server-side from the session. There is no `userId`
 * argument here to accidentally pass someone else's.
 *
 * The server applies the caller's id TWICE — assignment and workspace
 * membership — so a task assigned to you in a workspace you have since left
 * does not appear. That is the server's rule, restated here only so nobody
 * adds a client-side filter believing it is missing.
 *
 * `state=all`, ALWAYS — even though the page usually shows only open work.
 * The progress bar needs the DENOMINATOR: "8 of 20 done" cannot be computed
 * from a list the server already stripped the finished eight out of. Asking
 * for open work and then asking again for the counts would be two requests to
 * answer one question, so the page takes the whole list (capped at 200, a
 * person's realistic workload) and does the To do / Done split itself.
 *
 * The endpoint keeps its `state` parameter regardless — it is the right
 * default for any caller that wants a list rather than a ratio.
 */

/** The API's ceiling. One request draws a realistic workload; the list does not paginate yet. */
const MAX_PAGE_SIZE = 200;

export async function getAssignedTasks(): Promise<AssignedTask[]> {
  const params = new URLSearchParams({ state: "all", limit: String(MAX_PAGE_SIZE) });
  const result = await apiCallWithRefresh<AssignedTask[]>(`/tasks/assigned?${params.toString()}`);

  return result.ok ? result.data : [];
}
