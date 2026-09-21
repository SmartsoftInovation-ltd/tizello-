import type { ProjectSprint } from "@/types/project-sprint";
import { SPRINT_STATES, type SprintState } from "@/types/sprint";

/*
 * The sprints LIST's ordering rules for LIVE sprints — the same job
 * `sprint-groups.ts` does for the fixture `SprintRecord`, against the record
 * the API actually returns (`ProjectSprint`).
 *
 * Two modules rather than a generic one, for the reason `sprint-groups.ts`
 * already gives about itself and `project-groups.ts`: the shapes disagree
 * about which dates may be null, and a helper taking four accessors would be
 * harder to read than either. The LABELS and BLURBS are not duplicated —
 * `SPRINT_STATE_LABEL`, `SPRINT_STATE_BLURB` and `STATE_DOT` are imported from
 * the existing modules, so the two lists cannot describe "Completed"
 * differently.
 */

export type ProjectSprintGroup = {
  state: SprintState;
  sprints: ProjectSprint[];
};

/**
 * The date a band sorts on, as a comparable string.
 *
 * **Every field it prefers is nullable**, which is the whole reason this is a
 * function: a PLANNING sprint booked for "after this one" has no dates yet, and
 * `null.localeCompare` would take the page down. `createdAt` is the floor — a
 * row always has one — so an undated sprint sorts by when it was booked rather
 * than vanishing to one end.
 *
 * COMPLETED reads `completedAt` rather than `endDate`: a sprint closed early is
 * closed on the day it was closed, not on the day the box was planned to end.
 */
function sortKey(sprint: ProjectSprint, state: SprintState): string {
  return state === "COMPLETED"
    ? (sprint.completedAt ?? sprint.endDate ?? sprint.createdAt)
    : (sprint.startDate ?? sprint.createdAt);
}

/**
 * One entry per state in `SPRINT_STATES` display order — ACTIVE, PLANNING,
 * COMPLETED — with EMPTY BANDS DROPPED, exactly as `groupByState` does.
 *
 * Inside a band: COMPLETED runs newest first, because the sprint that just
 * closed is the one anybody opening this screen is looking for. The other two
 * run oldest first, which is the order they will happen in.
 */
export function groupProjectSprints(sprints: ProjectSprint[]): ProjectSprintGroup[] {
  return SPRINT_STATES.map((state) => ({
    state,
    sprints: sprints
      .filter((sprint) => sprint.state === state)
      .sort((a, b) =>
        state === "COMPLETED"
          ? sortKey(b, state).localeCompare(sortKey(a, state))
          : sortKey(a, state).localeCompare(sortKey(b, state)),
      ),
  })).filter((group) => group.sprints.length > 0);
}

/** How many sprints are closed — the count the toolbar states in words. */
export function completedCount(sprints: ProjectSprint[]): number {
  return sprints.filter((sprint) => sprint.state === "COMPLETED").length;
}

/** The one running sprint, if there is one. */
export function runningSprint(sprints: ProjectSprint[]): ProjectSprint | undefined {
  return sprints.find((sprint) => sprint.state === "ACTIVE");
}
