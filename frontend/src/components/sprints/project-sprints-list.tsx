import { ProjectSprintCard } from "@/components/sprints/project-sprint-card";
import { STATE_DOT } from "@/components/sprints/sprint-tone";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/plural";
import { completedCount, groupProjectSprints, runningSprint } from "@/lib/project-sprint-groups";
import { SPRINT_STATE_BLURB, SPRINT_STATE_LABEL } from "@/lib/sprint-groups";
import type { ProjectSprint } from "@/types/project-sprint";

/*
 * Every sprint a project has — running, queued and CLOSED — in state bands.
 *
 * This is the screen the completed sprints live on. The board
 * (`/board/sprint`) shows only the ACTIVE sprint, and planning
 * (`/board/sprint-planning`) filters COMPLETED out through `openSprints`, so
 * without this list a closed sprint had nowhere to be read.
 *
 * A Server Component, all the way down: nothing here is interactive, so the
 * archive ships no JavaScript.
 *
 * The labels, blurbs and the band order come from `sprint-groups.ts` — the
 * fixture list's own module — so the two screens cannot describe "Completed"
 * with two different sentences.
 */
export function ProjectSprintsList({
  sprints,
  today,
}: {
  sprints: ProjectSprint[];
  /** The app's pinned today, computed once on the server. */
  today: string;
}) {
  const groups = groupProjectSprints(sprints);
  const running = runningSprint(sprints);
  const closed = completedCount(sprints);

  if (groups.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-border bg-panel px-4 py-12 text-center">
        <p className="text-sm font-semibold text-text">No sprints yet</p>
        <p className="mt-1 text-xs text-text-muted">
          Sprints are created on sprint planning. Once one is closed it is kept here.
        </p>
      </div>
    );
  }

  return (
    <section className="min-h-0 flex-1 overflow-y-auto pb-8">
      {/* The count strip. Read-only, unlike `SprintsToolbar` — there is nothing
          to create from an archive, and every transition already has a home on
          planning. */}
      <p className="mt-4 border-b border-border pb-2 text-xs text-text-subtle">
        <span className="font-semibold text-text">
          {plural(sprints.length, "sprint", "sprints")}
        </span>
        {running ? <> &middot; {running.name} is running</> : <> &middot; none active</>}
        {closed > 0 && <> &middot; {closed} completed</>}
      </p>

      {groups.map((group) => (
        <section key={group.state} className="mt-6 first:mt-4">
          <div className="flex items-center gap-1.5">
            {/* Decorative: the state word sits beside it and every card repeats
                the state as a chip, so the dot is never the sole carrier. */}
            <span
              aria-hidden="true"
              className={cn("size-1.5 shrink-0 rounded-full", STATE_DOT[group.state])}
            />
            <h2 className="text-xs font-semibold tracking-widest text-text uppercase">
              {SPRINT_STATE_LABEL[group.state]}
            </h2>
            <span className="text-2xs tabular-nums text-text-subtle">
              {group.sprints.length}
            </span>
          </div>

          <p className="mt-0.5 text-2xs text-text-subtle">
            {SPRINT_STATE_BLURB[group.state]}
          </p>

          <ul className="mt-2 space-y-2">
            {group.sprints.map((sprint) => (
              <li key={sprint.id}>
                <ProjectSprintCard sprint={sprint} today={today} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
