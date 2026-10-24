import Link from "next/link";
import { SprintIcon } from "@/components/ui/nav-icons";
import type { ProjectRecord } from "@/types/project";

/**
 * The static chrome above the list: the way back to the project table, the
 * page's only `<h1>`, and one line saying what a sprint is.
 *
 * All server-rendered — nothing here changes as sprints are created, so none of
 * it ships JavaScript. "New sprint" lives on the toolbar below, which does:
 * that button opens a panel whose state belongs to the client leaf, and hoisting
 * it into this header would drag the whole header across the boundary with it.
 */
export function SprintsPageHeader({
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
        <SprintIcon className="size-5 shrink-0 text-text-muted" />
        Sprints
      </h1>
      <p className="mt-1 truncate text-sm text-text-muted">
        {project.name}&rsquo;s sprints: one running, the rest queued or closed.
      </p>
    </header>
  );
}
