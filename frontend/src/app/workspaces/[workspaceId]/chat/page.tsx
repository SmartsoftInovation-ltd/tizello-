import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ChatScreen } from "@/components/chat/chat-screen";
import { getSession } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
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

  /* The session says WHO is asking; the profile says what they look like.
     `getSession` carries no nickname and no photo, and the reader's own disc
     beside their own messages has to be the same face everybody else sees. */
  const [workspace, profile] = await Promise.all([getWorkspace(workspaceId), getProfile()]);
  if (!workspace) notFound();

  return (
    <ChatScreen
      workspaceId={workspaceId}
      workspaceName={workspace.name}
      viewer={{
        id: user.id,
        name: profile?.name ?? user.name,
        nickname: profile?.nickname ?? null,
        email: user.email,
        avatarUrl: profile?.avatarUrl ?? null,
      }}
    />
  );
}
