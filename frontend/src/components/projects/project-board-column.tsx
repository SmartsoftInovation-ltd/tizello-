"use client";

import type { BoardDrag } from "@/components/projects/use-project-board-dnd";
import type { ProjectScope } from "@/components/projects/project-properties";
import { NewProjectTrigger } from "@/components/projects/new-project-trigger";
import { SortableProjectCard } from "@/components/projects/sortable-project-card";
import { STATUS_BAR, STATUS_FILL } from "@/components/projects/project-tone";
import { StatusDot } from "@/components/projects/status-dot";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/plural";
import { STATUS_LABEL } from "@/lib/project-groups";
import type { ProjectRecord, ProjectStatus } from "@/types/project";

/*
 * One kanban column, and the drop zone inside it.
 *
 * `w-list` is Trello's 272px, the same width every other column in this app
 * uses.
 *
 * THERE IS NO DROPPABLE HERE ANY MORE. A column used to register itself with
 * @dnd-kit and be told when it was the target; now `lib/board-drag.ts` resolves
 * the target from geometry the board measured once, and this component is told
 * the answer. `data-column` and `data-cards` are what that measurement reads —
 * the section for the column's horizontal span, the list for where its cards
 * begin, which an EMPTY column has no card to supply.
 *
 * `STATUS_FILL` tints every column by default, so a status is recognisable at
 * a glance before any drag starts. Its edge stays transparent until the column
 * is the drop target — then `STATUS_BAR` adds the hairline in the strong
 * token, dashed and raised, which is what separates "lit" from "resting".
 *
 * `min-h-28` KEEPS AN EMPTY COLUMN A TARGET WORTH AIMING AT. Its older job was
 * breaking a feedback loop — a track that shrank when its empty state
 * unmounted moved its own bottom edge out from under the cursor, undoing the
 * collision that started the move. That loop is gone by construction now
 * (nothing reflows mid-drag), but a 0px-tall drop zone is still a bad one.
 */
const TRACK =
  "flex min-h-28 flex-col rounded-md border p-1 transition-[background-color,border-color,box-shadow] duration-100 ease-standard";

export function ProjectBoardColumn({
  status,
  projects,
  scope,
  canMove,
  drag,
  onPointerDown,
}: {
  status: ProjectStatus;
  /** Already in the column map's order — see `lib/project-board-order.ts`. */
  projects: ProjectRecord[];
  scope: ProjectScope;
  /** Decides which cards can be picked up — see `SortableProjectCard`. */
  canMove: (project: ProjectRecord) => boolean;
  /** The drag in progress, or `null`. Non-null in every column at once. */
  drag: BoardDrag | null;
  onPointerDown: (event: React.PointerEvent<HTMLElement>, id: string) => void;
}) {
  const headingId = `board-column-${status}`;
  const isDropTarget = drag?.target.status === status;
  const holdsCarried = Boolean(drag && projects.some((project) => project.id === drag.id));

  return (
    <section
      data-column={status}
      aria-labelledby={headingId}
      className={cn(
        "flex w-list shrink-0 flex-col gap-2 transition-opacity duration-100 ease-standard",
        /* The columns that are not the answer step back. Not hidden and not
           disabled — a drag can still change its mind — just quiet enough that
           the live one is the thing on screen. */
        drag && !isDropTarget && !holdsCarried && "opacity-60",
        /* THE COLUMN HOLDING THE CARRIED CARD IS NEVER DIMMED, and the reason
           is stacking rather than taste: `opacity` below 1 creates a stacking
           context, which would trap the lifted card inside this column and
           let the columns to its right paint OVER it — so a card dragged
           rightwards would slide underneath the cards it was aimed at. It is
           raised instead, so it paints above every sibling wherever it
           travels. */
        holdsCarried && "relative z-30",
      )}
    >
      <h3 id={headingId} className="flex items-center gap-1.5 px-0.5">
        <StatusDot status={status} />
        <span className="text-xs font-semibold text-text">
          {STATUS_LABEL[status]}
        </span>
        <span className="text-2xs tabular-nums text-text-subtle">
          {projects.length}
        </span>
      </h3>

      <div
        className={cn(
          /* `flex-1` absorbs the column's stretched height, so the zone is the
             full height of the rail rather than only as tall as its cards —
             which is what makes a drop into the empty space below the last
             card land, and that is where people aim. */
          "relative flex-1",
          TRACK,
          isDropTarget
            ? cn(STATUS_BAR[status], "border-dashed shadow-raised")
            : cn(STATUS_FILL[status], "border-transparent"),
        )}
      >
        {projects.length === 0 && (
          /* `absolute`, so it takes no space and cannot change the geometry
             the drag was measured against. It fades rather than unmounting. */
          <p
            className={cn(
              "pointer-events-none absolute inset-1 grid place-items-center rounded-md border border-dashed text-center text-xs transition-opacity duration-100 ease-standard",
              isDropTarget
                ? "border-transparent text-text-muted opacity-0"
                : "border-border bg-surface-sunken text-text-subtle",
            )}
          >
            Nothing in {STATUS_LABEL[status]}
          </p>
        )}

        {/* NO `gap` — the spacing is `pb-2` inside each card's own box, so the
            measured cards tile with no strip between them. */}
        <ul data-cards className="flex flex-col">
          {projects.map((project) => (
            <SortableProjectCard
              key={project.id}
              project={project}
              offset={drag ? (drag.offsets.get(project.id) ?? 0) : undefined}
              lifted={drag?.id === project.id}
              canMove={canMove(project)}
              onPointerDown={onPointerDown}
            />
          ))}
        </ul>
      </div>

      <NewProjectTrigger
        label={`New project in ${STATUS_LABEL[status]}, which has ${plural(projects.length, "project", "projects")}`}
        scope={scope}
        status={status}
      />
    </section>
  );
}
