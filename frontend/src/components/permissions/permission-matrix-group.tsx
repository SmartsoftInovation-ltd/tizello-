import { PermissionCell } from "@/components/permissions/permission-cell";
import { TableRow } from "@/components/ui/table";
import type { PermissionGroup, RoleDefinition } from "@/types/permissions";

/*
 * One area's block: a spanning group header, then a row per action. Returns a
 * fragment of `<tr>`s rather than a `<tbody>` of its own — four bodies in one
 * table is legal but leaves screen readers announcing four tables' worth of
 * structure for what is one list of actions.
 *
 * The action name is a real `<th scope="row">`: without it, a row read aloud
 * is four answers to a question nobody heard.
 */
const GROUP_HEAD =
  "bg-surface-sunken px-4 py-1 text-2xs font-semibold tracking-widest text-text-subtle uppercase";
const ROW_HEAD =
  "px-4 py-1.5 text-left text-sm font-normal whitespace-nowrap text-text";

export function PermissionMatrixGroup({
  group,
  roles,
}: {
  group: PermissionGroup;
  roles: RoleDefinition[];
}) {
  return (
    <>
      <TableRow>
        <th scope="colgroup" colSpan={roles.length + 1} className={GROUP_HEAD}>
          {group.label}
        </th>
      </TableRow>

      {group.actions.map((action) => (
        <TableRow key={action.id} className="hover:bg-surface-hover">
          <th scope="row" className={ROW_HEAD}>
            {action.label}
          </th>
          {roles.map((role) => (
            <PermissionCell
              key={role.id}
              role={role}
              allowed={role.permissions.includes(action.id)}
            />
          ))}
        </TableRow>
      ))}
    </>
  );
}
