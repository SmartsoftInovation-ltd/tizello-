"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CreateProjectDrawer } from "@/components/projects/create-project-drawer";
import type { ProjectScope } from "@/components/projects/project-properties";
import { PlusIcon } from "@/components/ui/icons";
import { loadProjectScopeAction } from "@/lib/actions/project-scope-actions";

/*
 * The sidebar Projects row's `+`: opens the same create-project drawer the
 * projects page uses, for the workspace the sidebar is showing.
 *
 * The drawer's scope (schema, roster, role) is loaded ON CLICK through
 * `loadProjectScopeAction` — the shell has no page to pass it, see that file.
 * It is kept after the first load, so a second `+` in the same workspace opens
 * instantly; a workspace switch remounts the sidebar row with a new id and
 * starts clean. While it loads the button is busy rather than dead, so a
 * double-click cannot fire two loads.
 */
export function SidebarNewProjectButton({
  workspaceId,
  label,
  className,
}: {
  workspaceId: string;
  /** Accessible name — "New project in Projects". */
  label: string;
  className?: string;
}) {
  const [scope, setScope] = useState<ProjectScope | null>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function openDrawer() {
    if (scope?.workspaceId === workspaceId) {
      setOpen(true);
      return;
    }

    startTransition(async () => {
      const loaded = await loadProjectScopeAction(workspaceId);
      if (!loaded) {
        toast.error("You can't create projects in this workspace.");
        return;
      }
      setScope(loaded);
      setOpen(true);
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label={label}
        title="New project"
        aria-busy={isPending || undefined}
        disabled={isPending}
        onClick={openDrawer}
        className={className}
      >
        <PlusIcon className={isPending ? "size-3.5 animate-pulse" : "size-3.5"} />
      </button>

      {scope && <CreateProjectDrawer scope={scope} open={open} onOpenChange={setOpen} />}
    </>
  );
}
