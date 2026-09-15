import Link from "next/link";
import { redirect } from "next/navigation";
import { SprintWorkflowNav } from "@/components/sprint-board/sprint-workflow-nav";
import { ProjectSprintPlanning } from "@/components/sprint-planning/project-sprint-planning";
import { BacklogProjectPicker } from "@/components/tasks/backlog-project-picker";
import { boardProjectSelection } from "@/components/tasks/board-project-selection";
import { PlanningIcon } from "@/components/ui/nav-icons";
import { RememberWorkspace } from "@/components/workspace/remember-workspace";
import { getSession } from "@/lib/auth";

export const metadata = {
  title: "Sprint planning",
  description: "Drag work from the backlog into sprints, estimate it, and start and complete sprints — per project.",
};

/**
 * `/board/sprint-planning` — what the sidebar's Sprint planning link opens: the
 * REAL planning screen for one project, with the same `?project=` picker as
 * `/board/backlog` (`board-project-selection.ts`).
 *
 * A static segment, so it wins over `board/[boardId]` for this URL.
 */
export default async function BoardSprintPlanningPage({ searchParams }: PageProps<"/board/sprint-planning">) {
  const { project: requested } = await searchParams;

  const user = await getSession();
  if (!user) redirect("/sign-in?next=/board/sprint-planning");

  const { selected, requestedEntry, groups } = await boardProjectSelection(requested);

  return (
    <main className="w-full px-4 py-8 sm:px-6">
      {/* Only an explicit pick moves the remembered workspace — see the backlog page. */}
      {requestedEntry && <RememberWorkspace workspaceId={requestedEntry.workspace.id} />}

      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-text">
          <PlanningIcon className="size-5 shrink-0 text-text-muted" />
          Sprint planning
        </h1>
        <p className="mt-1 max-w-prose text-sm text-text-muted">
          {selected
            ? `Plan ${selected.project.name}'s sprints: drag work from the backlog into a sprint, estimate it, then start the sprint.`
            : "Sprints belong to a project. Create one to start planning."}
        </p>
      </header>

      <div className="mt-6 border-b border-border">
        <SprintWorkflowNav current="sprint-planning" />
      </div>

      {selected ? (
        <ProjectSprintPlanning
          workspace={selected.workspace}
          project={selected.project}
          userId={user.id}
          /* Beside Create sprint in the toolbar; `basePath` keeps a switch on this screen. */
          actions={
            <BacklogProjectPicker groups={groups} selectedId={selected.project.id} basePath="/board/sprint-planning" />
          }
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
