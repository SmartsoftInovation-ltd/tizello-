import { PageTop } from "@/components/layout/page-top";
import { notFound } from "next/navigation";
import { MembersPageHeader } from "@/components/members/members-page-header";
import { MembersPanel } from "@/components/members/members-panel";
import { getSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspaces";
import { getPendingInvitations } from "@/lib/invites";
import { getMembers } from "@/lib/members";
import { getRoles } from "@/lib/workspace-roles";

export async function generateMetadata({
  params,
}: PageProps<"/workspaces/[workspaceId]/members">) {
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
    title: `Members · ${workspace.name}`,
    description: `Everyone with access to ${workspace.name}, and what each of them can change.`,
  };
}

export default async function MembersPage({
  params,
}: PageProps<"/workspaces/[workspaceId]/members">) {
  const { workspaceId } = await params;
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) notFound();

  /* All three reads happen on the server and are handed down as plain props.
     Everything below the header is interactive from here on, so `MembersPanel`
     is the client leaf — the header itself ships no JavaScript.

     `getSession` rather than a fixture: `currentUserId` is what marks a row
     "You", and it is now also what locks that row's controls (you cannot change
     your own role, and leaving is a different endpoint), so a wrong id is a
     wrong lock rather than just a wrong label. */
  const [members, invitations, user, roles] = await Promise.all([
    getMembers(workspaceId),
    getPendingInvitations(workspaceId),
    getSession(),
    /* Every role — built-in and workspace-defined — for the invite dialog. */
    getRoles(workspaceId),
  ]);

  return (
    <main className="w-full px-4 pb-8 sm:px-6">
      <PageTop>
        <MembersPageHeader workspace={workspace} />
      </PageTop>
      <MembersPanel
        members={members}
        invitations={invitations}
        /* `??` not `!`: the session can lapse between the guard that let this
           render and this call, and an empty string matches no `userId`, which
           locks nothing and mislabels nothing. */
        currentUserId={user?.id ?? ""}
        viewerRole={workspace.role}
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        roles={roles}
      />
    </main>
  );
}
