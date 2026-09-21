import { CheckIcon, DashIcon } from "@/components/ui/icons";
import { TableCell } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import type { RoleDefinition } from "@/types/permissions";

/*
 * One answer in the matrix: allowed, or not.
 *
 * Neutral ink on a tinted fill, per the contrast table in DESIGN-SYSTEM.md:
 * `text-success` on `bg-success-subtle` is 2.82:1 in light and fails AA, so the
 * hue is carried by the fill and the glyph takes `text-text-muted`.
 *
 * Denial is a dash on the sunken fill rather than a red cross — most cells are
 * denials, and a screen of red marks would read as a screen of faults.
 *
 * EVERY CELL IS READ-ONLY, including a workspace's own roles. It used to be a
 * button on those, which made sense while the grid was `useState` over a
 * fixture. Against the real API each tap would be its own `PATCH` of the whole
 * permissions array — twelve requests to describe one role, each able to fail
 * on its own and leave the grid half-written. The dialog sends the set once,
 * and this table is what the answer looks like afterwards. It ships no
 * JavaScript now, which is the other half of the gain.
 */
const MARK = "inline-flex size-6 items-center justify-center rounded-xs";
const ALLOWED = "bg-brand-subtle text-text-muted";
const DENIED = "bg-surface-sunken text-text-subtle";

export function PermissionCell({
  role,
  allowed,
}: {
  role: RoleDefinition;
  allowed: boolean;
}) {
  return (
    <TableCell className="px-4 py-1.5 text-center">
      <span className={cn(MARK, allowed ? ALLOWED : DENIED)}>
        {allowed ? (
          <CheckIcon className="size-3.5" />
        ) : (
          <DashIcon className="size-3.5" />
        )}
        {/* The glyph is never the only carrier of meaning: a row read aloud
            names the role and the answer rather than a line of shapes. */}
        <span className="sr-only">
          {role.name}: {allowed ? "allowed" : "not allowed"}
        </span>
      </span>
    </TableCell>
  );
}
