"use client";

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
import { WorkspaceAvatar } from "@/components/workspace/workspace-avatar";
import type { Workspace } from "@/types/workspace";

/**
 * Feature 5 — switch from the workspace you are looking at to another one.
 *
 * A sibling of the sidebar's `WorkspaceSwitcher`, not a duplicate of it: that
 * one reads the active workspace from the URL because its layout has no
 * `workspaceId` to give it, while this one is handed the record the page
 * already fetched. It also lands on the SAME sub-page you were on — switching
 * from one workspace's members screen goes to the other's members screen rather
 * than dumping you at its overview, which is what makes it a switch rather than
 * a navigation.
 *
 * Every entry is a real `<a>` (`DropdownMenuItem`'s `href` branch), so a switch
 * is a normal navigation: middle-click, ⌘-click and the back button all work,
 * and nothing about it needs an event handler.
 */
export function WorkspaceSwitchMenu({
  workspaces,
  currentWorkspaceId,
  /** The path under `/workspaces/[id]` to preserve, e.g. `/members`. Empty for the overview. */
  subPath = "",
}: {
  workspaces: Workspace[];
  currentWorkspaceId: string;
  subPath?: string;
}) {
  const others = workspaces.filter((workspace) => workspace.id !== currentWorkspaceId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Switch to another workspace"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Switch
        <ChevronDownIcon className="size-3" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>

        {workspaces.map((workspace) => {
          const current = workspace.id === currentWorkspaceId;
          return (
            <DropdownMenuItem
              key={workspace.id}
              href={`/workspaces/${workspace.id}${subPath}`}
              aria-current={current ? "page" : undefined}
            >
              <WorkspaceAvatar
                name={workspace.name}
                icon={workspace.icon}
                imageUrl={workspace.imageUrl}
                color={workspace.color}
                accent={workspace.accent}
                size="sm"
              />
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              {current ? (
                <CheckIcon className="size-3.5 shrink-0 text-text-brand" />
              ) : (
                /* Holds the column open so the names stay aligned. */
                <span className="size-3.5 shrink-0" aria-hidden="true" />
              )}
            </DropdownMenuItem>
          );
        })}

        {others.length === 0 && (
          <p className="px-2 py-1.5 text-2xs text-text-subtle">
            This is your only workspace.
          </p>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem href="/workspaces">View all workspaces</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
