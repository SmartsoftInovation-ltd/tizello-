"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckIcon, ChevronDownIcon } from "@/components/ui/icons";

/**
 * Which project `/board/backlog` is showing.
 *
 * The sidebar's Backlog link carries no project — the shell has none to give
 * it — so the page picks one and this menu switches it. The choice lives in
 * the URL (`?project=`), not in state: a backlog link somebody shares opens on
 * the same project, and Back returns to the previous one.
 *
 * Grouped by workspace, because two workspaces may both have a "Website"
 * project and the key alone does not say whose it is.
 */
export type PickerGroup = {
  workspaceId: string;
  workspaceName: string;
  projects: { id: string; key: string; name: string }[];
};

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
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        {selected ? (
          <>
            <span className="font-mono text-2xs text-text-subtle">{selected.key}</span>
            <span className="max-w-48 truncate">{selected.name}</span>
          </>
        ) : (
          "Choose a project"
        )}
        <ChevronDownIcon className="size-3" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {groups.map((group, index) => (
          <Fragment key={group.workspaceId}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{group.workspaceName}</DropdownMenuLabel>
            {group.projects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                onSelect={() => router.push(`/board/backlog?project=${project.id}`)}
              >
                <span className="font-mono text-2xs text-text-subtle">{project.key}</span>
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
                {project.id === selectedId && <CheckIcon className="size-3.5 text-text-brand" />}
              </DropdownMenuItem>
            ))}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
