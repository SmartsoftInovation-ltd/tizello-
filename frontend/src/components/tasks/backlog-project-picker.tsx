"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { ProjectGlyph } from "@/components/projects/project-glyph";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckIcon, ChevronDownIcon } from "@/components/ui/icons";
import { WorkspaceAvatar } from "@/components/workspace/workspace-avatar";
import type { ProjectRecord } from "@/types/project";
import type { Workspace } from "@/types/workspace";

/**
 * Which project `/board/backlog` is showing.
 *
 * The sidebar's Backlog link carries no project — the shell has none to give
 * it — so the page picks one and this menu switches it. The choice lives in
 * the URL (`?project=`), not in state: a backlog link somebody shares opens on
 * the same project, and Back returns to the previous one.
 *
 * It sits in the backlog toolbar beside Statuses, so the trigger is the same
 * `outline` / `sm` button: the project's own glyph, its name and its key.
 * The menu is grouped by workspace, each under that workspace's avatar,
 * because two workspaces may both have a "Website" project and the key alone
 * does not say whose it is.
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
}: {
  groups: PickerGroup[];
  selectedId?: string;
}) {
  const router = useRouter();
  const selected = groups
    .flatMap((group) => group.projects)
    .find((project) => project.id === selectedId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={selected ? `Project: ${selected.name}. Choose another` : "Choose a project"}
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
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="max-h-96 w-72 overflow-y-auto">
        {groups.map(({ workspace, projects }, index) => (
          <Fragment key={workspace.id}>
            {index > 0 && <DropdownMenuSeparator />}
            <div className="flex items-center gap-2 px-2 pt-1.5 pb-1">
              <WorkspaceAvatar
                name={workspace.name}
                icon={workspace.icon}
                color={workspace.color}
                accent={workspace.accent}
                size="sm"
              />
              <span className="min-w-0 truncate text-2xs font-semibold tracking-widest text-text-subtle uppercase">
                {workspace.name}
              </span>
            </div>

            {projects.map((project) => {
              const current = project.id === selectedId;
              return (
                <DropdownMenuItem
                  key={project.id}
                  aria-current={current ? "page" : undefined}
                  className={current ? "bg-surface-hover text-text" : undefined}
                  onSelect={() => router.push(`/board/backlog?project=${project.id}`)}
                >
                  <ProjectGlyph icon={project.icon} color={project.color} />
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  <span className={KEY_CHIP}>{project.key}</span>
                  {current ? (
                    <CheckIcon className="size-3.5 shrink-0 text-text-brand" />
                  ) : (
                    /* Holds the column open so the keys stay aligned. */
                    <span className="size-3.5 shrink-0" aria-hidden="true" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
