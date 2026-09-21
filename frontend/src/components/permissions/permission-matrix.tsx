import { PermissionMatrixGroup } from "@/components/permissions/permission-matrix-group";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PermissionGroup, RoleDefinition } from "@/types/permissions";

/*
 * The precise answer to "what can this role do" — one row per permission the
 * server gates on, one column per role.
 *
 * Columns come from the role list, not from a fixed union, so a role created
 * above appears here the moment it is saved.
 *
 * READ-ONLY, ALL OF IT. See `permission-cell.tsx`: against the real API a
 * per-cell toggle is a PATCH of the whole permissions array, so twelve taps
 * would be twelve writes that can each fail on their own. Editing happens in
 * the role dialog, which sends the set once. The table ships no JavaScript.
 *
 * `Table` brings its own `overflow-x-auto`, which is what keeps five columns
 * from taking the page sideways at 360px.
 */
export function PermissionMatrix({
  groups,
  roles,
}: {
  groups: PermissionGroup[];
  roles: RoleDefinition[];
}) {
  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-text">Permissions</h2>
        <p className="text-2xs text-text-subtle">
          What the server actually checks. Edit a role to change a column.
        </p>
      </div>

      <div className="mt-3 overflow-hidden rounded-md border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface">
              <TableHead className="px-4 py-2">Action</TableHead>
              {roles.map((role) => (
                <TableHead
                  key={role.id}
                  className="px-4 py-2 text-center whitespace-nowrap"
                >
                  {role.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {groups.map((group) => (
              <PermissionMatrixGroup key={group.area} group={group} roles={roles} />
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
