import type { Workspace } from "@/types/workspace";

/**
 * The static chrome above the views: the page's only `<h1>` and one line
 * saying what the five views have in common. The way back is the content
 * strip's breadcrumb, so there is no back link here. All server-rendered —
 * switching a view is a navigation, so none of this ships JavaScript.
 */
export function ProjectsPageHeader({ workspace }: { workspace: Workspace }) {
  return (
    <header>
      <h1 className="text-xl font-semibold tracking-tight text-text">Projects</h1>
      <p className="mt-1 truncate text-sm text-text-muted">
        Every project in {workspace.name}.
      </p>
    </header>
  );
}
