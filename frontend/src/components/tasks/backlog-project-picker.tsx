"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectGlyph } from "@/components/projects/project-glyph";
import { ProjectPickerDialog } from "@/components/tasks/project-picker-dialog";
import { buttonVariants } from "@/components/ui/button";
import { ChevronDownIcon } from "@/components/ui/icons";
import type { ProjectRecord } from "@/types/project";
import type { Workspace } from "@/types/workspace";

/**
 * Which project a `/board/*` screen is showing — the backlog or sprint planning.
 *
 * The sidebar's links carry no project — the shell has none to give them — so
 * the page picks one and this switches it. The choice lives in the URL
 * (`?project=`), not in state: a link somebody shares opens on the same
 * project, and Back returns to the previous one.
 *
 * `basePath` is the screen's own route, so switching project on sprint planning
 * STAYS on sprint planning; it used to push `/board/backlog` unconditionally.
 *
 * The trigger is an `outline` / `sm` toolbar button — the project's glyph, name
 * and key. Choosing opens `ProjectPickerDialog`, a centred card rather than a
 * dropdown, because the list is long; that file says why.
 */
export type PickerGroup = {
  workspace: Pick<Workspace, "id" | "name" | "icon" | "color" | "accent">;
  projects: Pick<ProjectRecord, "id" | "key" | "name" | "icon" | "color">[];
};

const KEY_CHIP =
  "shrink-0 rounded-xs bg-surface-sunken px-1 py-px font-mono text-2xs font-medium text-text-subtle";

export function BacklogProjectPicker({
  groups,
  selectedId,
  basePath = "/board/backlog",
}: {
  groups: PickerGroup[];
  selectedId?: string;
  /** The route `?project=` is appended to. */
  basePath?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const selected = groups.flatMap((group) => group.projects).find((project) => project.id === selectedId);

  function choose(projectId: string) {
    setOpen(false);
    if (projectId !== selectedId) router.push(`${basePath}?project=${projectId}`);
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={selected ? `Project: ${selected.name}. Choose another` : "Choose a project"}
        onClick={() => {
          /* Remount per open, so the search starts empty every time. */
          setDialogKey((current) => current + 1);
          setOpen(true);
        }}
        className={buttonVariants({ variant: "outline", size: "sm", className: "max-w-64" })}
      >
        {selected ? (
          <>
            <ProjectGlyph icon={selected.icon} color={selected.color} size="sm" />
            <span className="min-w-0 truncate">{selected.name}</span>
            <span className={KEY_CHIP}>{selected.key}</span>
          </>
        ) : (
          "Choose a project"
        )}
        <ChevronDownIcon className="size-3 shrink-0 text-text-subtle" />
      </button>

      <ProjectPickerDialog
        key={dialogKey}
        open={open}
        groups={groups}
        selectedId={selectedId}
        onChoose={choose}
        onOpenChange={setOpen}
      />
    </>
  );
}
