"use client";

import { useState, useTransition } from "react";
import { InviteMemberDialog } from "@/components/members/invite-member-dialog";
import { MembersList } from "@/components/members/members-list";
import { MembersToolbar } from "@/components/members/members-toolbar";
import { PendingInvitesPanel } from "@/components/members/pending-invites-panel";
import { RemoveMemberDialog } from "@/components/members/remove-member-dialog";
import { TabPanel, type TabDescriptor } from "@/components/ui/tabs";
import {
  inviteMemberAction,
  revokeInvitationAction,
} from "@/lib/actions/invitation-actions";
import { useMemberMutations } from "@/components/members/use-member-mutations";
import { inviteErrorCopy } from "@/lib/invite-error-copy";
import { sortInvitations } from "@/lib/invite-sort";
import { toast } from "sonner";
import type { RoleDefinition } from "@/types/permissions";
import type {
  InvitableRole,
  PendingInvitation,
  WorkspaceMember,
  WorkspaceRole,
} from "@/types/workspace";

/*
 * The interactive half of the members screen. The page above it stays a Server
 * Component and hands both fetched lists down as props; this leaf owns what a
 * static tree cannot: which tab is up, the roster as edited, the outstanding
 * invitations, and which removal is awaiting confirmation.
 *
 * Both arrays live here rather than in their panels because the tab strip
 * renders their counts. The panels below own only their own dialogs.
 *
 * **Everything on this screen is REAL.** Invite and cancel go through
 * `invitation-actions.ts`; role change and remove go through `member-actions.ts`
 * by way of `useMemberMutations`. Each action calls the API and revalidates this
 * route, which is what makes a change survive a reload; each list is also held
 * in state, which is what makes it immediate.
 *
 * `viewerRole` is what decides whether a row's controls are drawn at all. It is
 * a MIRROR of the API's permission table (`lib/roles.ts`) and draws controls
 * only — `requirePermission` on the server is what allows anything.
 */
const GROUP = "members";

export function MembersPanel({
  members: roster,
  invitations,
  currentUserId,
  viewerRole,
  workspaceId,
  workspaceName,
  roles,
}: {
  members: WorkspaceMember[];
  invitations: PendingInvitation[];
  currentUserId: string;
  /** The signed-in user's own role in this workspace, from `GET /workspaces/:id`. */
  viewerRole: WorkspaceRole;
  workspaceId: string;
  workspaceName: string;
  /** Every role in the workspace — what the invite dialog offers. */
  roles: RoleDefinition[];
}) {
  const [tab, setTab] = useState("members");
  const [invites, setInvites] = useState(invitations);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  /* The roster and its two writes. Its own transition, so a slow role change
     does not put the invite dialog's button into a pending state. */
  const {
    members,
    pendingRemoval,
    setPendingRemoval,
    changeRole,
    confirmRemoval,
  } = useMemberMutations(roster, workspaceId);

  const tabs: TabDescriptor[] = [
    { value: "members", label: "Members", count: members.length },
    { value: "pending", label: "Pending", count: invites.length },
  ];

  /* An invitation creates a PENDING row rather than a member: nobody has
     accepted, so nobody belongs on the roster yet.

     The row is added only AFTER the action succeeds, not optimistically. An
     invite can fail for reasons the client cannot predict — already a member,
     already invited, no permission — and showing a row that then disappears is
     worse than a half-second wait. `new Date()` is safe here: this runs in an
     event handler, never during a render the server also performed, so there is
     nothing for hydration to disagree with. */
  function invite(email: string, role: InvitableRole, roleId: string | null) {
    startTransition(async () => {
      const result = await inviteMemberAction({ workspaceId, email, role, roleId });

      if (!result.ok) {
        toast.error(inviteErrorCopy(result.code));
        return;
      }

      setInvites((current) =>
        sortInvitations([
          ...current,
          {
            id: crypto.randomUUID(),
            email,
            role,
            roleName: roles.find((entry) => entry.id === roleId && !entry.builtIn)?.name ?? null,
            invitedAt: new Date().toISOString(),
            status: "PENDING",
          },
        ]),
      );
      setTab("pending");
      toast.success(`Invitation sent to ${email}.`);
    });
  }

  function cancelInvite(invitationId: string) {
    const cancelled = invites.find((entry) => entry.id === invitationId);

    startTransition(async () => {
      const result = await revokeInvitationAction(workspaceId, invitationId);

      if (!result.ok) {
        toast.error(inviteErrorCopy(result.code));
        return;
      }

      setInvites((current) =>
        current.filter((invitation) => invitation.id !== invitationId),
      );
      toast.success(
        cancelled
          ? `Invitation to ${cancelled.email} cancelled.`
          : "Invitation cancelled.",
      );
    });
  }

  return (
    <section className="mt-8">
      <MembersToolbar
        group={GROUP}
        tabs={tabs}
        tab={tab}
        onTabChange={setTab}
        onInvite={() => setInviteOpen(true)}
      />

      <TabPanel group={GROUP} value="members" active={tab === "members"}>
        <MembersList
          members={members}
          currentUserId={currentUserId}
          viewerRole={viewerRole}
          onRoleChange={changeRole}
          onRemove={setPendingRemoval}
        />
      </TabPanel>

      <TabPanel group={GROUP} value="pending" active={tab === "pending"}>
        <PendingInvitesPanel
          invitations={invites}
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          onCancel={cancelInvite}
        />
      </TabPanel>

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        workspaceName={workspaceName}
        pending={isPending}
        roles={roles}
        onInvite={invite}
      />

      <RemoveMemberDialog
        member={pendingRemoval}
        workspaceName={workspaceName}
        onOpenChange={() => setPendingRemoval(null)}
        onConfirm={confirmRemoval}
      />
    </section>
  );
}
