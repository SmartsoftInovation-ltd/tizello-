import Link from "next/link";
import { redirect } from "next/navigation";
import { ProjectSprintBreakdown } from "@/components/sprint-breakdown/project-sprint-breakdown";
import { SprintWorkflowNav } from "@/components/sprint-board/sprint-workflow-nav";
import { BacklogProjectPicker } from "@/components/tasks/backlog-project-picker";
import { boardProjectSelection } from "@/components/tasks/board-project-selection";
import { SprintIcon } from "@/components/ui/nav-icons";
import { RememberWorkspace } from "@/components/workspace/remember-workspace";
import { getSession } from "@/lib/auth";
import { parseBreakdownChart } from "@/lib/sprint-breakdown-view";

export const metadata = {
  title: "Sprint breakdown",
  description: "The running sprint measured three ways — status share, workload per person, and the timeline.",
};

/**
 * `/board/sprint/breakdown` — the sidebar's Breakdown row under Sprint board,
 * and the fourth tab on the sprint workflow strip.
 *
 * A ROUTE OF ITS OWN rather than a `?view=` on the board, because the two
 * screens do not share a layout: the board pins itself to the viewport so its
 * columns scroll inside themselves, while this one is a document that scrolls
 * as a whole. Folding them into one page would mean one of the two fighting
 * the other's overflow rules for the rest of its life.
 *
 * `?project=` picks the project exactly as the board and backlog do, and
 * `?chart=` picks which of the three is drawn.
 */
export default async function SprintBreakdownPage({ searchParams }: PageProps<"/board/sprint/breakdown">) {
  const { project: requested, chart } = await searchParams;

  const user = await getSession();
  if (!user) redirect("/sign-in?next=/board/sprint/breakdown");

  const { selected, requestedEntry, groups } = await boardProjectSelection(requested);

  return (
    <main className="flex h-full w-full flex-col overflow-hidden px-4 pt-5 pb-3 sm:px-6">
      {requestedEntry && <RememberWorkspace workspaceId={requestedEntry.workspace.id} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-text">
          <SprintIcon className="size-5 shrink-0 text-text-muted" />
          Sprint breakdown
        </h1>
        {selected && <BacklogProjectPicker groups={groups} selectedId={selected.project.id} basePath="/board/sprint/breakdown" />}
      </div>

      <div className="mt-3 border-b border-border">
        <SprintWorkflowNav current="sprint-breakdown" projectId={selected?.project.id} />
      </div>

      {selected ? (
        <ProjectSprintBreakdown
          workspace={selected.workspace}
          project={selected.project}
          userId={user.id}
          chart={parseBreakdownChart(chart)}
        />
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
