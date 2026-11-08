import { PendingInviteMenu } from "@/components/members/pending-invite-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClockIcon } from "@/components/ui/icons";
import { RoleBadge } from "@/components/workspace/role-badge";
import { formatDate } from "@/lib/format-date";
import type { PendingInvitation } from "@/types/workspace";

/*
 * Flat and bordered, exactly like `MemberRow` — the two lists sit behind the
 * same tab strip and have to read as one list grammar, not two. Same stack to
 * `flex-col` below `sm`, for the same reason: a single line at 360px would
 * have to choose between a truncated address and a clipped menu.
 *
 * NO AVATAR, deliberately. A pending invitation has no person behind it — no
 * account, no name, nothing to draw initials from. Building a disc out of the
 * local part of the address would invent an identity that does not exist yet,
 * so the address leads the row and the discs start when someone accepts.
 */
const ROW =
  "flex flex-col gap-3 rounded-md border border-border bg-surface p-3 transition-colors duration-100 ease-standard hover:bg-surface-hover sm:flex-row sm:items-center sm:gap-4";

export function PendingInviteRow({
  invitation,
  resent,
  onResend,
  onCancel,
}: {
  invitation: PendingInvitation;
  /** True once this session has resent it — the click's visible result. */
  resent: boolean;
  onResend: () => void;
  onCancel: () => void;
}) {
  const { email, role, roleName, invitedAt } = invitation;

  return (
    <div className={ROW}>
      <div className="min-w-0">
        {/* Long addresses truncate rather than widen the row; `min-w-0` on
            every ancestor up to the flex row is what makes that work. */}
        <p className="truncate text-sm font-medium text-text">{email}</p>
        <p className="mt-0.5 truncate text-xs text-text-subtle">
          {/* A fixed date, not "3 days ago": relative time is computed from
              `now`, which differs between the server render and hydration. */}
          Invited {formatDate(invitedAt)}
          {resent && <span className="text-text-muted"> · Resent</span>}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-auto">
        <Badge variant="warning">
          {/* Amber ink is allowed here — an icon clears the 3:1 bar the badge
              label could not. It is decorative: "Pending" carries the meaning. */}
          <ClockIcon className="size-3 shrink-0 text-warning" />
          Pending
        </Badge>
        <RoleBadge role={role} name={roleName} />

        {/* Named for the invitee: "Resend" alone is three identical buttons. */}
        <Button
          variant="outline"
          size="sm"
          aria-label={`Resend invite to ${email}`}
          onClick={onResend}
        >
          Resend
        </Button>

        <PendingInviteMenu email={email} onCancel={onCancel} />
      </div>
    </div>
  );
}
