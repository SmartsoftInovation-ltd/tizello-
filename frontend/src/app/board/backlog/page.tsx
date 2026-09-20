import { PageTop } from "@/components/layout/page-top";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BacklogProjectPicker } from "@/components/tasks/backlog-project-picker";
import { SprintWorkflowNav } from "@/components/sprint-board/sprint-workflow-nav";
import { boardProjectSelection } from "@/components/tasks/board-project-selection";
import { ProjectBacklog } from "@/components/tasks/project-backlog";
import { BacklogIcon } from "@/components/ui/nav-icons";
import { RememberWorkspace } from "@/components/workspace/remember-workspace";
import { getSession } from "@/lib/auth";

export const metadata = {
  title: "Backlog",
  description: "Every task not yet committed to a sprint, per project.",
};

/**
 * `/board/backlog` — what the sidebar's Backlog link opens, now the REAL
 * backlog rather than the fixture board it used to be.
 *
 * A static segment, so it wins over `board/[boardId]` for this one URL; the
 * sprint board at `/board/sprint` is untouched.
 *
 * A backlog belongs to a project and the sidebar has none to pass, so the
 * project comes from `?project=` — resolved by `board-project-selection.ts`,
 * which the sprint-planning screen shares.
 */
export default async function BoardBacklogPage({ searchParams }: PageProps<"/board/backlog">) {
  const { project: requested } = await searchParams;

  const user = await getSession();
  if (!user) redirect("/sign-in?next=/board/backlog");

  const { selected, requestedEntry, groups } = await boardProjectSelection(requested);

  const tabs = <SprintWorkflowNav current="backlog" projectId={selected?.project.id} />;

  return (
    <main className="w-full px-4 pb-8 sm:px-6">
      {/* Only an explicit pick moves the remembered workspace. The fallback to
          another workspace's project (the remembered one has none) must not
          overwrite the user's choice. */}
      {requestedEntry && <RememberWorkspace workspaceId={requestedEntry.workspace.id} />}

      <PageTop>
        <header className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-text">
            <BacklogIcon className="size-5 shrink-0 text-text-muted" />
            Backlog
          </h1>
          <p className="mt-1 max-w-prose text-sm text-text-muted">
            {selected
              ? `Everything ${selected.project.name} might do, grouped by status. Planning is what moves a task into a sprint.`
              : "A backlog belongs to a project. Create one to start adding tasks."}
          </p>
        </header>
      </PageTop>

      {selected ? (
        /* Tabs on the left of the toolbar, the project picker beside
           Statuses on the right — one row, see `TaskBacklogToolbar`. */
        <ProjectBacklog
          workspace={selected.workspace}
          project={selected.project}
          userId={user.id}
          leading={tabs}
          actions={<BacklogProjectPicker groups={groups} selectedId={selected.project.id} />}
        />
      ) : (
        <>
          <div className="mt-6 border-b border-border">{tabs}</div>
          <div className="mt-6 rounded-md border border-dashed border-border bg-surface-sunken px-4 py-10 text-center">
            <p className="text-sm font-medium text-text">No projects yet</p>
            <Link
              href="/workspaces"
              className="mt-2 inline-block text-xs font-medium text-text-brand hover:underline"
            >
              Go to your workspaces &rarr;
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
