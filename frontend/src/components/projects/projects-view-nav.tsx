import Link from "next/link";
import {
  PROJECT_VIEW_LABEL,
  PROJECT_VIEW_TAB,
  projectsHref,
} from "@/lib/project-view";
import type { ProjectFilters } from "@/lib/project-filters";
import { LinkPendingLoader } from "@/components/ui/link-pending-loader";
import { PROJECT_VIEWS, type ProjectView } from "@/types/project";

/*
 * NAVIGATION, not a tabs widget.
 *
 * Switching a view changes the URL, so each of these is a real `<a>` inside a
 * `<nav>`, and the current one carries `aria-current="page"`. Deliberately NOT
 * `role="tablist"` / `role="tab"`, and deliberately not `ui/tabs.tsx`: that
 * primitive is for co-located panels in one document, and `role="tab"` on a
 * link that navigates tells a screen-reader user the page will not move when
 * it is about to.
 *
 * The payoff is that all five views stay server-rendered, and every view is
 * linkable, bookmarkable and back-buttonable. The only client JS is
 * `LinkPendingLoader` inside each link: a view switch stays in this route
 * segment, so `loading.tsx` never shows, and without it the old view sits on
 * screen with no feedback while the new one renders.
 *
 * The visible label is short; `aria-label` gives the full one ("Status" →
 * "Status breakdown"). The visible text opens the accessible name, so
 * voice control still matches on what is on screen.
 */
const ACTIVE =
  "inline-block border-b-2 border-brand-500 px-2 pb-1.5 text-xs font-semibold text-text";
const IDLE =
  "inline-block border-b-2 border-transparent px-2 pb-1.5 text-xs font-medium text-text-muted transition-colors duration-100 ease-standard hover:border-border-strong hover:text-text";

export function ProjectsViewNav({
  workspaceId,
  view,
  filters,
}: {
  workspaceId: string;
  view: ProjectView;
  /** Carried into every link, so switching a view never widens the result. */
  filters: ProjectFilters;
}) {
  const { archived } = filters;
  return (
    <nav aria-label="Project views" className="min-w-0">
      <ul className="scrollbar-board flex items-center gap-1 overflow-x-auto">
        {PROJECT_VIEWS.map((value) => {
          /* Not `value === view` alone: with Archived in the same row, the
             archived screen would otherwise light up two tabs at once — its
             own, and whichever view it happens to be drawn in. */
          const current = value === view && !archived;
          return (
            <li key={value}>
              <Link
                href={projectsHref(workspaceId, value, { ...filters, archived: false })}
                aria-current={current ? "page" : undefined}
                aria-label={PROJECT_VIEW_LABEL[value]}
                className={current ? ACTIVE : IDLE}
              >
                {PROJECT_VIEW_TAB[value]}
                <LinkPendingLoader label={`Loading the ${PROJECT_VIEW_LABEL[value].toLowerCase()} view`} />
              </Link>
            </li>
          );
        })}

        {/* A sixth tab, not a sixth view: it keeps whichever view is current
            and flips `?archived=1`. Archived projects are excluded from every
            other list by the API, so this is the only route back to one. */}
        <li>
          <Link
            href={projectsHref(workspaceId, view, { ...filters, archived: true })}
            aria-current={archived ? "page" : undefined}
            aria-label="Projects that have been archived."
            className={archived ? ACTIVE : IDLE}
          >
            Archived
            <LinkPendingLoader label="Loading archived projects" />
          </Link>
        </li>
      </ul>
    </nav>
  );
}
