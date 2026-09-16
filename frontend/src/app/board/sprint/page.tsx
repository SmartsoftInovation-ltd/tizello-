import Link from "next/link";
import { redirect } from "next/navigation";
import { ProjectCurrentSprint } from "@/components/current-sprint/project-current-sprint";
import { SprintWorkflowNav } from "@/components/sprint-board/sprint-workflow-nav";
import { BacklogProjectPicker } from "@/components/tasks/backlog-project-picker";
import { boardProjectSelection } from "@/components/tasks/board-project-selection";
import { SprintIcon } from "@/components/ui/nav-icons";
import { RememberWorkspace } from "@/components/workspace/remember-workspace";
import { getSession } from "@/lib/auth";

export const metadata = {
  title: "Current sprint",
  description: "The running sprint as a board — one column per status, including the ones your team adds.",
};

/**
 * `/board/sprint` — the sidebar's Current sprint link: the REAL board for one
 * project's active sprint, with the same `?project=` picker as the backlog and
 * sprint planning (`board-project-selection.ts`).
 *
 * A static segment, so it wins over `board/[boardId]`, which drew a fixture
 * sprint here before.
 *
 * FITS THE VIEWPORT. `h-full` + `overflow-hidden` pins the page to the shell's
 * scroll region, and the board below takes whatever height is left — so the
 * page never scrolls vertically; a long column scrolls inside itself instead.
 */
export default async function CurrentSprintPage({ searchParams }: PageProps<"/board/sprint">) {
  const { project: requested } = await searchParams;

  const user = await getSession();
  if (!user) redirect("/sign-in?next=/board/sprint");

  const { selected, requestedEntry, groups } = await boardProjectSelection(requested);

  return (
    <main className="flex h-full w-full flex-col overflow-hidden px-4 pt-5 pb-3 sm:px-6">
      {requestedEntry && <RememberWorkspace workspaceId={requestedEntry.workspace.id} />}

      <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-text">
        <SprintIcon className="size-5 shrink-0 text-text-muted" />
        Current sprint
      </h1>

      <div className="mt-3 border-b border-border">
        <SprintWorkflowNav current="current-sprint" />
      </div>

      {selected ? (
        <ProjectCurrentSprint
          workspace={selected.workspace}
          project={selected.project}
          userId={user.id}
          /* Beside Statuses in the sprint card. */
          actions={<BacklogProjectPicker groups={groups} selectedId={selected.project.id} basePath="/board/sprint" />}
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
