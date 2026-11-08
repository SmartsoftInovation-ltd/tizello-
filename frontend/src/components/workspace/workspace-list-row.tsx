import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { RoleBadge } from "@/components/workspace/role-badge";
import { WorkspaceActionsMenu } from "@/components/workspace/workspace-actions-menu";
import { WorkspaceAvatar } from "@/components/workspace/workspace-avatar";
import { formatDate } from "@/lib/format-date";
import type { Workspace } from "@/types/workspace";

/**
 * One workspace as a row. The same record the card draws, at the density a
 * table buys: role, status and both dates are columns here rather than the
 * three things a card has room for.
 *
 * The whole row is NOT one link — there is a menu in the last cell, and a
 * `<button>` inside an `<a>` is invalid HTML. The name is the link instead,
 * with `after:absolute after:inset-0` stretching its hit area over its own
 * cell: a `relative` on the CELL, never on the `<tr>`. A table row is not a
 * dependable containing block, and an overlay that escapes one resolves against
 * the viewport — an invisible link across the whole page.
 *
 * Dates go through `formatDate` — locale and time zone are pinned there, so the
 * server and the browser cannot render different text and trip a hydration
 * mismatch.
 */
export function WorkspaceListRow({ workspace }: { workspace: Workspace }) {
  const { id, name, slug, description, icon, imageUrl, color, role, isArchived } = workspace;

  return (
    <TableRow className="hover:bg-surface-hover">
      <TableCell className="relative max-w-xs">
        <div className="flex items-center gap-2.5">
          <WorkspaceAvatar name={name} icon={icon} imageUrl={imageUrl} color={color} size="sm" />
          <div className="min-w-0">
            <Link
              href={`/workspaces/${id}`}
              className="block truncate font-medium text-text after:absolute after:inset-0"
            >
              {name}
            </Link>
            <p className="truncate text-2xs text-text-subtle">
              {description ?? `@${slug}`}
            </p>
          </div>
        </div>
      </TableCell>

      <TableCell>
        <RoleBadge role={role} />
      </TableCell>

      <TableCell>
        {isArchived ? (
          <Badge variant="warning">Archived</Badge>
        ) : (
          <Badge variant="outline">Active</Badge>
        )}
      </TableCell>

      <TableCell className="text-2xs whitespace-nowrap text-text-subtle">
        {formatDate(workspace.createdAt)}
      </TableCell>

      <TableCell className="text-2xs whitespace-nowrap text-text-subtle">
        {formatDate(workspace.updatedAt)}
      </TableCell>

      <TableCell className="w-9 text-right">
        <WorkspaceActionsMenu workspace={workspace} showOpenLink />
      </TableCell>
    </TableRow>
  );
}
