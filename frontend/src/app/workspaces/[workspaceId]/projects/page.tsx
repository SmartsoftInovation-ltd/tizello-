import { PageTop } from "@/components/layout/page-top";
import { notFound, redirect } from "next/navigation";
import { ProjectsPageHeader } from "@/components/projects/projects-page-header";
import { ProjectsToolbar } from "@/components/projects/projects-toolbar";
import { ProjectsViewNav } from "@/components/projects/projects-view-nav";
import { ProjectsPrefsScope } from "@/components/projects/projects-prefs-scope";
import { ProjectsViewPanel } from "@/components/projects/projects-view-panel";
import { getSession } from "@/lib/auth";
import { getWorkspaceProjects } from "@/lib/projects";
import { getProjectPropertyDefs } from "@/lib/project-property-defs";
import { canManageProperties } from "@/lib/project-roles";
import { getWorkspace, getWorkspaceMembers } from "@/lib/workspaces";
import { todayIso } from "@/lib/today";
import { parseProjectFilters } from "@/lib/project-filters";
import { sortProjects } from "@/lib/project-sort";
import { parseProjectView, PROJECT_VIEW_LABEL } from "@/lib/project-view";

export async function generateMetadata({
  params,
}: PageProps<"/workspaces/[workspaceId]/projects">) {
  const { workspaceId } = await params;
  const workspace = await getWorkspace(workspaceId);

  if (!workspace) {
    return {
      title: "Workspace not found",
      description:
        "This workspace does not exist, or it is no longer shared with you.",
    };
  }

  return {
    title: `Projects · ${workspace.name}`,
    description: `Every project in ${workspace.name}, as a table, a timeline, a board, a flat list or a status breakdown.`,
  };
}

export default async function ProjectsPage({
  params,
  searchParams,
}: PageProps<"/workspaces/[workspaceId]/projects">) {
  /* Both are Promises in Next 16, and both are awaited. `?view=` is validated
     against an `as const` list and falls back to `active` for anything
     unrecognised — a junk query string is a typo, not a 500. */
  const [{ workspaceId }, query] = await Promise.all([params, searchParams]);
  const view = parseProjectView(query.view);
  /* EVERY NARROWING REACHES THE FETCH, not a `.filter()` over the result: the
     API matches `q` against name and key, takes `status`, `priority` and
     `mine`, and omits archived rows from the payload entirely unless asked —
     none of which a filter here could reproduce, and the endpoint caps at 100
     rows so narrowing after the fact would narrow a PAGE rather than the set.
     `project-filters.ts` owns the parsing, including what a junk param falls
     back to. */
  const filters = parseProjectFilters(query);
  const { archived } = filters;

  const user = await getSession();
  if (!user) redirect(`/sign-in?next=/workspaces/${workspaceId}/projects`);

  const workspace = await getWorkspace(workspaceId);
  if (!workspace) notFound();

  /* `GET /workspaces/:id/projects` — every project in the workspace, including
     ones the caller is not a member of (project.md §*Guards* step 4). */
  /* `includeArchived` returns archived AND active rows — the API has no
     archived-only filter — so the archived view narrows the result here. The
     same shape `/workspaces?archived=1` already uses. */
  /* The schema is fetched alongside the rows and passed down as part of the
     scope: every drawer on this page renders the same columns, so fetching it
     per trigger would be one request per board column. */
  /* The roster comes along for the ride: the create drawer draws a
     collaborator picker, and fetching it per "+ New project" trigger would be
     one request per board column. */
  const [all, definitions, workspaceMembers] = await Promise.all([
    getWorkspaceProjects(workspaceId, {
      q: filters.q,
      status: filters.status,
      priority: filters.priority,
      mine: filters.mine,
      includeArchived: archived,
    }),
    getProjectPropertyDefs(workspaceId),
    getWorkspaceMembers(workspaceId),
  ]);
  const visible = archived ? all.filter((project) => project.isArchived) : all;
  /* Ordering is the one part the API cannot do — see `lib/project-sort.ts`. It
     runs here, once, rather than in each view: all five render from this array
     and two of them group it, so a per-view sort would give the same records
     two different orders on one screen. */
  const projects = sortProjects(visible, filters.sort, filters.direction);

  /* One object rather than five props: `workspaceId`, `workspaceName`,
     `today`, the schema and the admin flag all travel together to every
     "+ New project" trigger four levels down. See `project-properties.ts`. */
  const scope = {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    today: todayIso(),
    definitions,
    canManageProperties: canManageProperties(workspace.role),
    currentUserId: user?.id,
    workspaceMembers,
  };

  return (
    <main className="w-full px-4 pb-8 sm:px-6">
      <PageTop className="pb-0">
        <ProjectsPageHeader workspace={workspace} />

        {/* The strip wraps rather than scrolls: at 360px the five view links
            take the first line and the toolbar drops below them. */}
        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <ProjectsViewNav workspaceId={workspace.id} view={view} filters={filters} />
          <div className="pb-1.5">
            <ProjectsToolbar scope={scope} view={view} filters={filters} />
          </div>
        </div>
      </PageTop>

      {/* The wrapper carries every layout preference as an attribute; the
          views inside stay server-rendered. See `projects-prefs-scope.tsx`. */}
      <ProjectsPrefsScope>
        <ProjectsViewPanel
          view={view}
          projects={projects}
          currentUserId={user.id}
          workspaceRole={workspace.role}
          /* Resolved on the server and passed down, never read from a clock in
             a component — see `lib/today.ts` for why that distinction is
             load-bearing rather than stylistic. */
          today={todayIso()}
          /* One prop rather than three: `workspaceId`, `workspaceName` and
             `today` travel together to every "+ New project" trigger four
             levels down. See `project-properties.ts`. */
          scope={scope}
        />
      </ProjectsPrefsScope>

      <p className="sr-only">
        Showing the {PROJECT_VIEW_LABEL[view]} view.
      </p>
    </main>
  );
}
