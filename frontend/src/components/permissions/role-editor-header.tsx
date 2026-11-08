import { ShieldIcon } from "@/components/ui/app-icons";

/**
 * The role editor's only `<h1>` — the same shape as `PermissionsPageHeader`.
 * The way back is the content strip's breadcrumb
 * (Home › Roles & permissions › New role).
 */
export function RoleEditorHeader({ title }: { title: string }) {
  return (
    <header>
      <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-text">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-subtle text-text-brand">
          <ShieldIcon className="size-4" />
        </span>
        {title}
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        Give it a name, choose an access level and pick its permissions.
      </p>
    </header>
  );
}
