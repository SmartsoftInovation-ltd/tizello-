"use client";

import { useEffect } from "react";
import { rememberWorkspace } from "@/lib/active-workspace";

/**
 * Remembers a workspace from a screen whose URL does not name one — the
 * backlog, when a project from another workspace is picked. Renders nothing.
 */
export function RememberWorkspace({ workspaceId }: { workspaceId: string }) {
  useEffect(() => {
    rememberWorkspace(workspaceId);
  }, [workspaceId]);

  return null;
}
