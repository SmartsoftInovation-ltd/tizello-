import Link from "next/link";
import { BacklogIcon } from "@/components/ui/nav-icons";
import type { ProjectRecord } from "@/types/project";

/**
 * The static chrome above the list: the way back to the project table, the
 * page's only `<h1>`, and one line saying what a backlog is for.
 *
 * All server-rendered — nothing here changes as tasks are added, so none of it
 * ships JavaScript. The count lives on the toolbar below, which does.
 */
export function BacklogPageHeader({
  workspaceId,
  project,
}: {
  workspaceId: string;
  project: ProjectRecord;
}) {
  return (
    <header>
      <Link
        href={`/workspaces/${workspaceId}/projects/${project.id}`}
        className="inline-block rounded-xs text-2xs font-medium text-text-subtle transition-colors duration-100 ease-standard hover:text-text-muted"
      >
        ← {project.name}
      </Link>

      <h1 className="mt-2 flex items-center gap-2 text-xl font-semibold tracking-tight text-text">
        <BacklogIcon className="size-5 shrink-0 text-text-muted" />
        Backlog
      </h1>
      <p className="mt-1 max-w-prose text-sm text-text-muted">
        Everything {project.name} might do, grouped by status. Nothing here is
        committed to a sprint yet &mdash; planning is what moves a task out.
      </p>
    </header>
  );
}
