import { PageTop } from "@/components/layout/page-top";
import { notFound } from "next/navigation";
import { SprintsPageHeader } from "@/components/sprints/sprints-page-header";
import { SprintsPanel } from "@/components/sprints/sprints-panel";
import { getWorkspace } from "@/lib/workspaces";
import { DEMO_TODAY, getProject } from "@/lib/demo-projects";
import { getProjectSprints } from "@/lib/demo-sprints";

export async function generateMetadata({
  params,
}: PageProps<"/workspaces/[workspaceId]/projects/[projectId]/sprints">) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (!project) {
    return {
      title: "Project not found",
      description:
        "This project does not exist, or it is no longer shared with you.",
    };
  }

  return {
    title: `Sprints · ${project.name}`,
    description: `The time-boxes ${project.name} plans in — one running, the rest queued or closed.`,
  };
}

export default async function ProjectSprintsPage({
  params,
}: PageProps<"/workspaces/[workspaceId]/projects/[projectId]/sprints">) {
  /* `params` is a Promise in Next 16, and it is awaited. */
  const { workspaceId, projectId } = await params;

  /* Both reads happen on the server. A missing workspace or a missing project
     is `notFound()`, not an empty shell — a sprint belongs to a project, and a
     page that renders the chrome around nothing is a worse answer than 404. */
  const [workspace, project] = await Promise.all([
    getWorkspace(workspaceId),
    getProject(projectId),
  ]);
  if (!workspace || !project) notFound();

  const sprints = await getProjectSprints(projectId);

  return (
    <main className="w-full px-4 pb-8 sm:px-6">
      <PageTop>
        <SprintsPageHeader workspaceId={workspace.id} project={project} />
      </PageTop>

      {/* Everything below the header is interactive, so `SprintsPanel` is the
          client leaf — the header itself ships no JavaScript.

          `today` is the app's pinned date rather than a live clock: a value
          read from `new Date()` during render differs between the server pass
          and hydration, and React throws the node away. See `demo-projects.ts`. */}
      <SprintsPanel sprints={sprints} today={DEMO_TODAY} />
    </main>
  );
}
