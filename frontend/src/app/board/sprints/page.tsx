import Link from "next/link";
import { redirect } from "next/navigation";
import { ProjectSprintsList } from "@/components/sprints/project-sprints-list";
import { SprintWorkflowNav } from "@/components/sprint-board/sprint-workflow-nav";
import { BacklogProjectPicker } from "@/components/tasks/backlog-project-picker";
import { boardProjectSelection } from "@/components/tasks/board-project-selection";
import { SprintIcon } from "@/components/ui/nav-icons";
import { RememberWorkspace } from "@/components/workspace/remember-workspace";
import { getSession } from "@/lib/auth";
import { getSprints } from "@/lib/sprints";
import { todayIso } from "@/lib/today";

export const metadata = {
  title: "Sprints",
  description: "Every sprint a project has had — the one running, the ones queued, and the completed ones.",
};

/**
 * `/board/sprints` — the sidebar's Sprints row under Sprint board, and the last
 * tab on the sprint workflow strip.
 *
 * WHY IT EXISTS. A COMPLETED sprint had nowhere to be read. `/board/sprint`
 * renders only the ACTIVE sprint (`activeSprint` in `lib/current-sprint.ts`),
 * `/board/sprint-planning` filters closed sprints out on purpose
 * (`openSprints` in `lib/sprint-plan.ts`), and the per-project list at
 * `/workspaces/[id]/projects/[id]/sprints` still reads `demo-sprints.ts`. So a
 * sprint that was completed simply disappeared from the product.
 *
 * It picks its project from `?project=` exactly as the board, the breakdown and
 * the backlog do, through the same `boardProjectSelection` — so the tab strip
 * carries the reader between the five screens without changing project.
 *
 * READ-ONLY. Creating, editing, starting and completing a sprint all belong to
 * planning, which owns the Server Actions for them. This is the record.
 */
export default async function BoardSprintsPage({ searchParams }: PageProps<"/board/sprints">) {
  const { project: requested } = await searchParams;

  const user = await getSession();
  if (!user) redirect("/sign-in?next=/board/sprints");

  const { selected, requestedEntry, groups } = await boardProjectSelection(requested);
  /* Live, through the same endpoint the board and planning read
     (`GET /projects/:id/sprints`) — every state, not just the open ones. */
  const sprints = selected ? await getSprints(selected.project.id) : [];

  return (
    <main className="flex h-full w-full flex-col overflow-hidden px-4 pt-5 pb-3 sm:px-6">
      {requestedEntry && <RememberWorkspace workspaceId={requestedEntry.workspace.id} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-text">
          <SprintIcon className="size-5 shrink-0 text-text-muted" />
          Sprints
        </h1>
        {selected && (
          <BacklogProjectPicker groups={groups} selectedId={selected.project.id} basePath="/board/sprints" />
        )}
      </div>

      <div className="mt-3 border-b border-border">
        <SprintWorkflowNav current="sprints" projectId={selected?.project.id} />
      </div>

      {selected ? (
        <ProjectSprintsList sprints={sprints} today={todayIso()} />
      ) : (
        <div className="mt-6 rounded-md border border-dashed border-border bg-surface-sunken px-4 py-10 text-center">
          <p className="text-sm font-medium text-text">No projects yet</p>
          <Link href="/workspaces" className="mt-2 inline-block text-xs font-medium text-text-brand hover:underline">
            Go to your workspaces &rarr;
          </Link>
        </div>
      )}
    </main>
  );
}
