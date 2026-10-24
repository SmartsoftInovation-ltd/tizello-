import Link from "next/link";
import type { Workspace } from "@/types/workspace";

/**
 * The static chrome above the roster: the way back, the page's only `<h1>`,
 * and one line explaining what a role buys you. All of it is server-rendered —
 * only the roster below it is interactive.
 */
export function MembersPageHeader({ workspace }: { workspace: Workspace }) {
  return (
    <header>
      <Link
        href={`/workspaces/${workspace.id}`}
        className="inline-block rounded-xs text-2xs font-medium text-text-subtle transition-colors duration-100 ease-standard hover:text-text-muted"
      >
        ← {workspace.name}
      </Link>

      <h1 className="mt-2 text-xl font-semibold tracking-tight text-text">
        Members
      </h1>
      <p className="mt-1 truncate text-sm text-text-muted">
        Everyone with access to this workspace, and who is still invited.
      </p>
    </header>
  );
}
