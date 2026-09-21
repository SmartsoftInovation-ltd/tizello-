import Link from "next/link";
import { PLANNING_CHILDREN } from "@/lib/nav-links";

/*
 * The tab strip across the sprint workflow's screens — Current sprint,
 * Breakdown, Sprint planning, Backlog and Sprints — styled like
 * `ProjectsViewNav` so both strips read as the same control.
 *
 * NAVIGATION, not a tabs widget, for the reason that file gives: each tab is a
 * different URL, so these are real `<a>`s in a `<nav>` with `aria-current`, and
 * the strip ships no JavaScript.
 *
 * The links are `PLANNING_CHILDREN`, the same array the sidebar filters for its
 * own rows, so a tab and a sidebar row can never point at two different places.
 *
 * THIS STRIP SHOWS MORE THAN THE SIDEBAR. Breakdown is `tabOnly` — a lens on
 * the board rather than a stage of the workflow, so it earns a tab here and no
 * permanent sidebar row. See `tabOnly` in `types/nav.ts`.
 *
 * THE PROJECT RIDES ALONG. Each of these screens picks its project from
 * `?project=`, so a tab that dropped the param would quietly move the reader to
 * whichever project happens to sort first — the same board, a different team's
 * work. The sidebar's own rows carry no project (there is none to carry from a
 * nav that does not know where you are); a tab always does.
 */
const ACTIVE =
  "inline-block border-b-2 border-brand-500 px-2 pb-1.5 text-xs font-semibold text-text";
const IDLE =
  "inline-block border-b-2 border-transparent px-2 pb-1.5 text-xs font-medium text-text-muted transition-colors duration-100 ease-standard hover:border-border-strong hover:text-text";

export type SprintWorkflowTab =
  | "current-sprint"
  | "sprint-breakdown"
  | "sprint-planning"
  | "backlog"
  | "sprints";

export function SprintWorkflowNav({ current, projectId }: { current: SprintWorkflowTab; projectId?: string }) {
  const href = (to: string) => (projectId ? `${to}?project=${projectId}` : to);

  return (
    <nav aria-label="Sprint workflow" className="min-w-0">
      <ul className="scrollbar-board flex items-center gap-1 overflow-x-auto">
        {PLANNING_CHILDREN.map((tab) =>
          tab.href ? (
            <li key={tab.id}>
              <Link
                href={href(tab.href)}
                aria-current={tab.id === current ? "page" : undefined}
                className={tab.id === current ? ACTIVE : IDLE}
              >
                {tab.label}
              </Link>
            </li>
          ) : null,
        )}
      </ul>
    </nav>
  );
}
