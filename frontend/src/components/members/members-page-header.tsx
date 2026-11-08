import type { Workspace } from "@/types/workspace";

/**
 * The static chrome above the roster: the page's only `<h1>` and one line
 * explaining what it lists. The way back is the content strip's breadcrumb,
 * so there is no back link here. All of it is server-rendered — only the
 * roster below it is interactive.
 */
export function MembersPageHeader({ workspace }: { workspace: Workspace }) {
  return (
    <header>
      <h1 className="text-xl font-semibold tracking-tight text-text">Members</h1>
      <p className="mt-1 truncate text-sm text-text-muted">
        Everyone with access to {workspace.name}, and who is still invited.
      </p>
    </header>
  );
}
