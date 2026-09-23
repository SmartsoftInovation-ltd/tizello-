import { Suspense } from "react";
import { ProjectChat } from "@/components/chat/project-chat";

/**
 * The shell every screen of one project shares — which today is exactly one
 * thing: the channel.
 *
 * A LAYOUT RATHER THAN A HEADER BUTTON, because the chat panel has to open
 * over the project record, the backlog, sprint planning and the sprint list
 * alike, and those four pages share no header component. A layout is the one
 * place that covers all of them and does not re-mount as you move between
 * them — so the panel stays open while you navigate, which is most of the
 * point of a slide-over.
 *
 * `<Suspense>` keeps the launcher's three reads off the critical path: every
 * project screen renders immediately and the button, with its unread count,
 * fills in.
 */
export default async function ProjectLayout({
  children,
  params,
}: LayoutProps<"/workspaces/[workspaceId]/projects/[projectId]">) {
  const { workspaceId, projectId } = await params;

  return (
    <>
      {children}
      <Suspense fallback={null}>
        <ProjectChat workspaceId={workspaceId} projectId={projectId} />
      </Suspense>
    </>
  );
}
