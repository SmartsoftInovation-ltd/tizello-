"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RolePermissionPicker } from "@/components/permissions/role-permission-picker";
import { RoleTierField } from "@/components/permissions/role-tier-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { createRoleAction, updateRoleAction } from "@/lib/actions/role-actions";
import { permissionsHref } from "@/lib/role-paths";
import {
  roleErrorCopy,
  type PermissionGroup,
  type RoleDefinition,
  type RoleTier,
} from "@/types/permissions";

/*
 * Create a role, or re-scope one — the body of the role editor PAGE. It was a
 * dialog; twelve permission rows with explanations outgrew a modal, and a page
 * gives the editor a URL, a back button and room to read.
 *
 * `role` is the one being edited, or `null` to create. The page renders this
 * fresh per visit, so the draft starts from `role` with no effect syncing
 * props into state.
 *
 * NAVIGATION HAPPENS ON SUCCESS, NOT ON SUBMIT. The write can be refused — a
 * duplicate name, or a permission the author does not hold — and leaving
 * optimistically would drop the draft while a toast explained a form the
 * reader can no longer see. The refusal renders inline in the action bar.
 */
export function RoleForm({
  workspaceId,
  role,
  groups,
}: {
  workspaceId: string;
  role: RoleDefinition | null;
  groups: PermissionGroup[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(role?.name ?? "");
  const [tier, setTier] = useState<RoleTier>(role?.baseRole ?? "MEMBER");
  const [permissions, setPermissions] = useState<readonly string[]>(role?.permissions ?? []);
  const [nameError, setNameError] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const back = permissionsHref(workspaceId);

  function toggle(actionId: string) {
    setPermissions((current) =>
      current.includes(actionId) ? current.filter((id) => id !== actionId) : [...current, actionId],
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
    setError(undefined);

    const input = { name: name.trim(), baseRole: tier, permissions };
    startTransition(async () => {
      const result = role
        ? await updateRoleAction(workspaceId, role.id, input)
        : await createRoleAction(workspaceId, input);

      if (!result.ok) {
        setError(roleErrorCopy(result.code));
        return;
      }
      toast.success(`${result.data.name} ${role ? "saved" : "created"}`);
      router.push(back);
    });
  }

  return (
    /* noValidate: the browser's bubble would pre-empt the inline error. */
    <form onSubmit={submit} noValidate className="mt-6 space-y-6">
      <section className="grid gap-5 rounded-lg border border-border bg-surface p-5 lg:grid-cols-2">
        <TextField
          label="Role name"
          name="name"
          placeholder="e.g. Reviewer, Designer, Client"
          defaultValue={role?.name ?? ""}
          error={nameError}
          onValueChange={setName}
          autoFocus
        />
        <RoleTierField value={tier} onChange={setTier} />
      </section>

      <RolePermissionPicker
        groups={groups}
        allowed={permissions}
        onToggle={toggle}
        onToggleArea={toggleArea}
      />

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-surface px-4 py-3 sm:-mx-6 sm:px-6">
        {error && (
          <p role="alert" className="rounded-sm bg-danger-subtle px-2.5 py-1.5 text-xs text-danger">
            {error}
          </p>
        )}
        <div className="ml-auto flex gap-2">
          <Link href={back} className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : role ? "Save changes" : "Create role"}
          </Button>
        </div>
      </div>
    </form>
  );
}
