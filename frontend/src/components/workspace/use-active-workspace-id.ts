"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  readStoredWorkspace,
  rememberWorkspace,
  subscribeToWorkspace,
} from "@/lib/active-workspace";
import { workspaceIdFromPath } from "@/lib/nav-links";

/**
 * The workspace the shell should treat as open: the one in the path when there
 * is one, otherwise the last one remembered (see `lib/active-workspace.ts`).
 *
 * Visiting a workspace route is what remembers it, so there is no separate
 * "select" step to forget — opening Tizaraa and then the backlog keeps Tizaraa.
 *
 * `initialStored` is the cookie as the server read it. It is the server
 * snapshot, so the first HTML and the hydration pass agree on the workspace
 * and the switcher does not flash "Workspaces" on `/board/*`.
 */
export function useActiveWorkspaceId(initialStored?: string): string | undefined {
  const fromPath = workspaceIdFromPath(usePathname());
  const stored = useSyncExternalStore(
    subscribeToWorkspace,
    readStoredWorkspace,
    () => initialStored,
  );

  useEffect(() => {
    if (fromPath) rememberWorkspace(fromPath);
  }, [fromPath]);

  return fromPath ?? stored;
}
