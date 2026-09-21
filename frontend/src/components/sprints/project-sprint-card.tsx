import { SprintCounts } from "@/components/sprints/sprint-counts";
import { SprintProgress } from "@/components/sprints/sprint-progress";
import { SprintStateBadge } from "@/components/sprints/sprint-state-badge";
import { SprintWindow } from "@/components/sprints/sprint-window";
import { CARD_BORDER } from "@/components/sprints/sprint-tone";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format-date";
import type { ProjectSprint } from "@/types/project-sprint";

/*
 * One LIVE sprint, read-only — the same card `sprint-card.tsx` draws, minus the
 * title button and the kebab.
 *
 * WHY NOT `SprintCard`. That one is the fixture list's card: its name is a
 * button into an editor whose every handler writes `useState` and persists
 * nothing, and its menu offers Start / Complete / Delete on the same terms.
 * This list reports real sprints, so a control that silently forgot what it did
 * would be worse than no control. Starting, completing and editing a sprint all
 * already happen on sprint planning, through real Server Actions — this is the
 * archive, and it says so by not pretending to be an editor.
 *
 * Everything below the header row is shared with the fixture card:
 * `SprintWindow`, `SprintCounts` and `SprintProgress` all take a narrow `Pick`
 * rather than a whole `SprintRecord`, so the two cards cannot drift apart.
 *
 * It ships no JavaScript — nothing here is interactive, so it stays a Server
 * Component.
 */
const CARD = "rounded-md border bg-surface p-3";

export function ProjectSprintCard({
  sprint,
  today,
}: {
  sprint: ProjectSprint;
  /** The app's pinned today, threaded down from the page. */
  today: string;
}) {
  /* Destructured so TypeScript narrows both to `string` inside the branch —
     a sprint still in PLANNING may have no dates yet, and `SprintWindow` would
     render "Invalid Date → Invalid Date" for a null. */
  const { startDate, endDate } = sprint;

  return (
    <article className={cn(CARD, CARD_BORDER[sprint.state])}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="shrink-0 text-2xs font-semibold tabular-nums text-text-subtle">
              {sprint.key}
            </span>
            {/* Plain text, not a button: see the note at the top. The page's
                <h1> is "Sprints" and the band heading is an <h2>, so this is
                the third level and the list stays skimmable by heading. */}
            <h3 className="min-w-0 flex-1 text-sm font-semibold text-text">
              {sprint.name}
            </h3>
          </div>

          <div className="mt-1">
            {startDate && endDate ? (
              <SprintWindow
                sprint={{ startDate, endDate, state: sprint.state }}
                today={today}
              />
            ) : (
              <p className="text-xs text-text-subtle italic">No dates set yet</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <SprintStateBadge state={sprint.state} />
        </div>
      </div>

      {sprint.goal && (
        <p className="mt-2 max-w-prose text-xs text-text-muted">
          <span className="font-semibold text-text">Goal: </span>
          {sprint.goal}
        </p>
      )}

      <div className="mt-2.5">
        <SprintCounts
          sprint={{ itemCount: sprint.taskCount, totalPoints: sprint.totalPoints }}
        />
      </div>

      {/* Progress is only honest once work has been committed. A PLANNING
          sprint has nothing done by definition, so a 0% bar there would be a
          statement about nothing. */}
      {sprint.state !== "PLANNING" && (
        <SprintProgress
          sprint={{
            doneCount: sprint.doneCount,
            itemCount: sprint.taskCount,
            state: sprint.state,
          }}
        />
      )}

      {/* The one fact this list exists for, and the card is the only place it
          fits: `completedAt` is when the sprint was actually closed, which is
          not `endDate` when it was closed early or late. */}
      {sprint.completedAt && (
        <p className="mt-2 text-2xs text-text-subtle">
          Closed {formatDate(sprint.completedAt)}
        </p>
      )}
    </article>
  );
}
