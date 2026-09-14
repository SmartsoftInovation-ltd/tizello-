import Link from "next/link";
import { PLANNING_CHILDREN } from "@/lib/nav-links";

/*
 * The tab strip across the sprint workflow's three screens — Current sprint,
 * Sprint planning, Backlog — styled like `ProjectsViewNav` so both strips read
 * as the same control.
 *
 * NAVIGATION, not a tabs widget, for the reason that file gives: each tab is a
 * different URL, so these are real `<a>`s in a `<nav>` with `aria-current`, and
 * the strip ships no JavaScript.
 *
 * The links are the sidebar's own `PLANNING_CHILDREN`, so a tab and the sidebar
 * row beneath Sprint board can never point at two different places.
 */
const ACTIVE =
  "inline-block border-b-2 border-brand-500 px-2 pb-1.5 text-xs font-semibold text-text";
const IDLE =
  "inline-block border-b-2 border-transparent px-2 pb-1.5 text-xs font-medium text-text-muted transition-colors duration-100 ease-standard hover:border-border-strong hover:text-text";

export type SprintWorkflowTab = "current-sprint" | "sprint-planning" | "backlog";

export function SprintWorkflowNav({ current }: { current: SprintWorkflowTab }) {
  return (
    <nav aria-label="Sprint workflow" className="min-w-0">
      <ul className="scrollbar-board flex items-center gap-1 overflow-x-auto">
        {PLANNING_CHILDREN.map((tab) =>
          tab.href ? (
            <li key={tab.id}>
              <Link
                href={tab.href}
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
