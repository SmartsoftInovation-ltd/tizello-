import Link from "next/link";
import { PlanningIcon } from "@/components/ui/nav-icons";
import type { ProjectRecord } from "@/types/project";

/**
 * The static chrome above the two panels: the way back to the project table,
 * the page's only `<h1>`, and one line saying what planning decides.
 *
 * All server-rendered — nothing here changes as tasks move, so none of it ships
 * JavaScript. The sprint selector, the capacity meter and "Start sprint" all
 * live on the bar below, which does: every one of them reads state this header
 * would have to be dragged across the boundary to see.
 */
export function PlanningPageHeader({
  workspaceId,
  project,
}: {
  workspaceId: string;
  project: ProjectRecord;
}) {
  return (
    <header>
      <Link
        href={`/workspaces/${workspaceId}/projects`}
        className="inline-block rounded-xs text-2xs font-medium text-text-subtle transition-colors duration-100 ease-standard hover:text-text-muted"
      >
        ← {project.name}
      </Link>

      <h1 className="mt-2 flex items-center gap-2 text-xl font-semibold tracking-tight text-text">
        <PlanningIcon className="size-5 shrink-0 text-text-muted" />
        Sprint planning
      </h1>
      <p className="mt-1 max-w-prose text-sm text-text-muted">
        Drag {project.name}&rsquo;s work from the backlog into a sprint and
        estimate it. A task is in one place or the other, never both, and the
        points tell you when the sprint is full.
      </p>
    </header>
  );
}
