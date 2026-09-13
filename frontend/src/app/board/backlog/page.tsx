import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BacklogProjectPicker,
  type PickerGroup,
} from "@/components/tasks/backlog-project-picker";
import { ProjectBacklog } from "@/components/tasks/project-backlog";
import { BacklogIcon } from "@/components/ui/nav-icons";
import { getSession } from "@/lib/auth";
import { getWorkspaceProjects } from "@/lib/projects";
import { getWorkspaces } from "@/lib/workspaces";

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
 * project comes from `?project=` and falls back to the first project the
 * caller can see. Every workspace's project list is read in parallel — one
 * request per workspace, and people belong to a handful.
 */
export default async function BoardBacklogPage({ searchParams }: PageProps<"/board/backlog">) {
  const { project: requested } = await searchParams;

  const user = await getSession();
  if (!user) redirect("/sign-in?next=/board/backlog");

  const workspaces = await getWorkspaces();
  const lists = await Promise.all(
    workspaces.map(async (workspace) => ({
      workspace,
      projects: await getWorkspaceProjects(workspace.id),
    })),
  );

  const entries = lists.flatMap(({ workspace, projects }) =>
    projects.map((project) => ({ workspace, project })),
  );
  const selected =
    entries.find(({ project }) => project.id === requested) ?? entries[0];

  const groups: PickerGroup[] = lists
    .filter(({ projects }) => projects.length > 0)
    .map(({ workspace, projects }) => ({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      projects: projects.map(({ id, key, name }) => ({ id, key, name })),
    }));

  return (
    <main className="w-full px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-text">
            <BacklogIcon className="size-5 shrink-0 text-text-muted" />
            Backlog
          </h1>
          <p className="mt-1 max-w-prose text-sm text-text-muted">
            {selected
              ? `Everything ${selected.project.name} might do, grouped by status. Planning is what moves a task into a sprint.`
              : "A backlog belongs to a project. Create one to start adding tasks."}
          </p>
        </div>

        {groups.length > 0 && (
          <BacklogProjectPicker groups={groups} selectedId={selected?.project.id} />
        )}
      </header>

      {selected ? (
        <ProjectBacklog
          workspace={selected.workspace}
          project={selected.project}
          userId={user.id}
        />
      ) : (
        <div className="mt-6 rounded-md border border-dashed border-border bg-surface-sunken px-4 py-10 text-center">
          <p className="text-sm font-medium text-text">No projects yet</p>
          <Link
            href="/workspaces"
            className="mt-2 inline-block text-xs font-medium text-text-brand hover:underline"
          >
            Go to your workspaces &rarr;
          </Link>
        </div>
      )}
    </main>
  );
}
