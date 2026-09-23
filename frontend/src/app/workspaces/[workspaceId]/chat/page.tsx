import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ChatScreen } from "@/components/chat/chat-screen";
import { getSession } from "@/lib/auth";
import { canRemoveMember } from "@/lib/roles";
import { getWorkspace } from "@/lib/workspaces";

export const metadata: Metadata = {
  title: "Chat",
  description: "The workspace channel — everyone who belongs here.",
};

/**
 * The workspace channel — `backend/docs/api/chat.md`.
 *
 * ONE CONVERSATION PER WORKSPACE, and every member is in it. There is no
 * per-project chat: it existed for a day and was removed, because two channels
 * meant two places to look for the same conversation and the narrower one kept
 * excluding the people a message was about.
 *
 * A Server Component that resolves who is asking and hands a plain object to
 * the client screen, so the header is right in the first byte of HTML and the
 * fetching code never ships. The messages themselves are NOT fetched here:
 * they arrive through the socket and a Server Action behind it, because a
 * route that re-renders per message would re-run every Server Component on the
 * page and lose the scroll position.
 *
 * `notFound()` on a workspace the caller is not in, matching the API: it
 * answers `404` rather than `403`, since confirming a workspace exists to
 * somebody outside it is itself the leak.
 */
export default async function WorkspaceChatPage({
  params,
}: PageProps<"/workspaces/[workspaceId]/chat">) {
  const { workspaceId } = await params;

  const user = await getSession();
  if (!user) redirect(`/sign-in?next=/workspaces/${workspaceId}/chat`);

  const workspace = await getWorkspace(workspaceId);
  if (!workspace) notFound();

  return (
    <ChatScreen
      workspaceId={workspaceId}
      workspaceName={workspace.name}
      viewer={{
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: null,
      }}
      /* Deleting somebody else's message is deliberately the same tier that
         may remove a member — OWNER or ADMIN — so `canRemoveMember` is reused
         rather than a second predicate that means the same thing. The API
         applies the same rule and refuses regardless of what this renders. */
      canModerate={canRemoveMember(workspace.role)}
    />
  );
}
