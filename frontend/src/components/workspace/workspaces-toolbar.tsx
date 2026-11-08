import Link from "next/link";
import { LinkPendingLoader } from "@/components/ui/link-pending-loader";
import {
  WORKSPACE_VIEW_LABEL,
  WORKSPACE_VIEW_SUMMARY,
  workspacesHref,
} from "@/lib/workspace-view";
import { WORKSPACE_VIEWS, type WorkspaceView } from "@/types/workspace";

/*
 * The strip above the workspace list: how it is drawn, and whether archived
 * workspaces are in it.
 *
 * NAVIGATION, not a tabs widget — both controls change the URL, so each is a
 * real `<a>` inside a `<nav>` and the current one carries `aria-current`.
 * Deliberately not `ui/tabs.tsx`: `role="tab"` on a link that navigates tells a
 * screen-reader user the page will not move when it is about to. The payoff is
 * that both views stay server-rendered with zero client JS for the switch, and
 * "my archived workspaces as a list" is a URL somebody can bookmark.
 *
 * The archived link is the only way back to a workspace that has been archived
 * — the API omits archived rows from the default list entirely — so it is a
 * permanent part of the strip rather than something that appears once there is
 * something in it. A count would need a second request to know.
 */
const VIEW_ACTIVE =
  "inline-block border-b-2 border-brand-500 px-2 pb-1.5 text-xs font-semibold text-text";
const VIEW_IDLE =
  "inline-block border-b-2 border-transparent px-2 pb-1.5 text-xs font-medium text-text-muted transition-colors duration-100 ease-standard hover:border-border-strong hover:text-text";

const FILTER_ACTIVE =
  "inline-flex items-center rounded-xs bg-brand-100 px-2 py-1 text-2xs font-semibold text-brand-800";
/* Resting state IS the old hover state — `text-text` on a `surface-hover`
   fill. At `text-2xs` the muted ink on no fill was reading as disabled, and
   this is one of two routes back to an archived workspace. Hover then has to
   step past it, hence `surface-sunken`. */
const FILTER_IDLE =
  "inline-flex items-center rounded-xs bg-surface-hover px-2 py-1 text-2xs font-medium text-text transition-colors duration-100 ease-standard hover:bg-surface-sunken";

export function WorkspacesToolbar({
  view,
  archived,
}: {
  view: WorkspaceView;
  archived: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border">
      <nav aria-label="Workspace views" className="min-w-0">
        <ul className="flex items-center gap-1">
          {WORKSPACE_VIEWS.map((value) => {
            /* Not `value === view` alone: with Archived in the same row, the
               archived screen would otherwise light up two tabs at once — its
               own, and whichever view it happens to be drawn in. */
            const current = value === view && !archived;
            return (
              <li key={value}>
                <Link
                  href={workspacesHref({ view: value, archived: false })}
                  aria-current={current ? "page" : undefined}
                  aria-label={WORKSPACE_VIEW_SUMMARY[value]}
                  className={current ? VIEW_ACTIVE : VIEW_IDLE}
                >
                  {WORKSPACE_VIEW_LABEL[value]}
                  <LinkPendingLoader label="Loading workspaces" />
                </Link>
              </li>
            );
          })}

          {/* A third tab, not a third view: it keeps whichever view is current
              and flips `?archived=1`. The link on the right does the same
              thing — this is the discoverable half, that one is the way back
              out. */}
          <li>
            <Link
              href={workspacesHref({ view, archived: true })}
              aria-current={archived ? "page" : undefined}
              aria-label="Workspaces you have archived."
              className={archived ? VIEW_ACTIVE : VIEW_IDLE}
            >
              Archived
              <LinkPendingLoader label="Loading archived workspaces" />
            </Link>
          </li>
        </ul>
      </nav>

      <div className="pb-1.5">
        <Link
          href={workspacesHref({ view, archived: !archived })}
          /* No `aria-pressed`: that is a button state, and this is a link.
             The label itself carries the state — "Show archived" is the
             invitation, "Showing archived" is the fact. */
          className={archived ? FILTER_ACTIVE : FILTER_IDLE}
        >
          {archived ? "Showing archived" : "Show archived"}
          <LinkPendingLoader label="Loading workspaces" />
        </Link>
      </div>
    </div>
  );
}
