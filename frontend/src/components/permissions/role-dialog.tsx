"use client";

import { useId, useState } from "react";
import { RoleTierField } from "@/components/permissions/role-tier-field";
import { RolePermissionPicker } from "@/components/permissions/role-permission-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TextField } from "@/components/ui/text-field";
import type {
  PermissionGroup,
  RoleDefinition,
  RoleInput,
  RoleTier,
} from "@/types/permissions";

/*
 * Create a role, or re-scope one. The same dialog for both: the fields are
 * identical, and two of these would be two places for the picker to drift.
 *
 * `role` is the one being edited, or `null` to create. The parent MOUNTS this
 * only while it is open, so the draft below starts from `role` and a cancelled
 * edit leaves nothing behind — no effect syncing props into state.
 *
 * THE TIER IS A FIELD, not a hidden default. A role sits on MEMBER or ADMIN,
 * and that decides every ladder check the permission grid does not cover. It
 * was implicit before because a fixture role gated nothing; now it is the
 * difference between a Reviewer who passes `roleAtLeast(role, ADMIN)` and one
 * who does not, so it has to be a decision somebody makes on purpose.
 *
 * The dialog does NOT close on submit. The write can be refused — a duplicate
 * name, or a permission the author does not hold themselves — and closing
 * optimistically would drop the draft and leave a toast explaining a form the
 * reader can no longer see. The parent closes it once the write lands.
 */
export function RoleDialog({
  open,
  onOpenChange,
  role,
  groups,
  error,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleDefinition | null;
  groups: PermissionGroup[];
  /** The last write's refusal, rendered inline rather than only as a toast. */
  error?: string;
  pending: boolean;
  onSubmit: (input: RoleInput) => void;
}) {
  const titleId = useId();
  const [name, setName] = useState(role?.name ?? "");
  const [tier, setTier] = useState<RoleTier>(role?.baseRole ?? "MEMBER");
  const [permissions, setPermissions] = useState<readonly string[]>(
    role?.permissions ?? [],
  );
  const [nameError, setNameError] = useState<string | undefined>();

  function toggle(actionId: string) {
    setPermissions((current) =>
      current.includes(actionId)
        ? current.filter((id) => id !== actionId)
        : [...current, actionId],
    );
  }

  /** Every action in one area on or off at once — the row a reader thinks in. */
  function toggleArea(group: PermissionGroup, grant: boolean) {
    const ids = group.actions.map((action) => action.id);

    setPermissions((current) =>
      grant
        ? [...current, ...ids.filter((id) => !current.includes(id))]
        : current.filter((id) => !ids.includes(id)),
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setNameError("Give the role a name");
      return;
    }

    setNameError(undefined);
    onSubmit({ name: name.trim(), baseRole: tier, permissions });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} aria-labelledby={titleId}>
      {/* noValidate: the browser's bubble would pre-empt the inline error. */}
      <form onSubmit={submit} noValidate>
        <DialogContent>
          <DialogHeader>
            <DialogTitle id={titleId}>
              {role ? `Edit ${role.name}` : "New role"}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <TextField
              label="Name"
              name="name"
              placeholder="Reviewer"
              defaultValue={role?.name ?? ""}
              error={nameError}
              onValueChange={setName}
              autoFocus
            />

            <RoleTierField value={tier} onChange={setTier} />

            <RolePermissionPicker
              groups={groups}
              allowed={permissions}
              onToggle={toggle}
              onToggleArea={toggleArea}
            />

            {error && (
              <p role="alert" className="text-xs text-danger">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : role ? "Save role" : "Create role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </form>
    </Dialog>
  );
}
