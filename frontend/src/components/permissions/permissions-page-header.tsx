import { ShieldIcon } from "@/components/ui/app-icons";
import type { Workspace } from "@/types/workspace";

/**
 * The page's only `<h1>`. The way back is the content strip's breadcrumb
 * (Home › Roles & permissions), so there is no back link here.
 */
export function PermissionsPageHeader({ workspace }: { workspace: Workspace }) {
  return (
    <header>
      <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-text">
        <ShieldIcon className="size-5 shrink-0 text-text-muted" />
        Roles &amp; permissions
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        Who can do what in {workspace.name}.
      </p>
    </header>
  );
}
