import { ChatLauncher } from "@/components/chat/chat-launcher";
import { getSession } from "@/lib/auth";
import { getUnreadCount } from "@/lib/chat";
import { getProject } from "@/lib/projects";
import { canWriteProject } from "@/lib/project-roles";
import { getWorkspace } from "@/lib/workspaces";

/**
 * The server half of the chat launcher: it resolves who is asking, what the
 * channel is called and how much they have not read, then hands a plain object
 * to the client leaf.
 *
 * A Server Component so the unread badge is right in the first byte of HTML
 * rather than appearing after hydration, and so the fetching code never ships.
 * It is mounted by the project layout and wrapped in `<Suspense>` there, which
 * keeps these three requests off the critical path of every project screen.
 *
 * IT RENDERS NOTHING WHEN THE CALLER CANNOT SEE THE PROJECT. The API answers a
 * non-member with `404` on every chat endpoint, so a launcher would open onto
 * a channel that refuses to load — better to have no button at all.
 *
 * `canModerate` only draws the delete control on somebody else's message. The
 * server applies the same ladder (`canWrite`: workspace OWNER/ADMIN, project
 * owner, MANAGER) and refuses regardless of what this renders.
 */
export async function ProjectChat({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const user = await getSession();
  if (!user) return null;

  const [project, workspace] = await Promise.all([
    getProject(projectId),
    getWorkspace(workspaceId),
  ]);

  if (!project || !workspace || project.workspaceId !== workspace.id) return null;

  const unreadCount = await getUnreadCount({ projectId });

  return (
    <ChatLauncher
      target={{ projectId }}
      title={project.name}
      label="Chat"
      viewer={{
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: null,
      }}
      canModerate={canWriteProject(workspace.role, project.viewerRole)}
      unreadCount={unreadCount}
    />
  );
}
