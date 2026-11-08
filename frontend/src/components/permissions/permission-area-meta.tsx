import { TasksIcon, ShieldIcon } from "@/components/ui/app-icons";
import { HomeIcon, MembersIcon, ProjectsIcon } from "@/components/ui/nav-icons";
import type { IconProps } from "@/components/ui/icons";

/*
 * The presentation layer over the API's permission catalog: an icon per AREA
 * and a one-line explanation per ACTION, for the role editor.
 *
 * The catalog itself (`GET .../roles/permissions`) stays the source of truth
 * for WHICH rows exist — this file only decorates them. An area or action the
 * API adds before this file learns about it still renders, with the fallback
 * icon and no hint, rather than disappearing: a switch the server enforces must
 * never be hidden because the copy is missing.
 */

const AREA_ICONS: Record<string, (props: IconProps) => React.ReactNode> = {
  workspace: HomeIcon,
  members: MembersIcon,
  projects: ProjectsIcon,
  tasks: TasksIcon,
  roles: ShieldIcon,
};

export function PermissionAreaIcon({ area, className }: { area: string } & IconProps) {
  const Glyph = AREA_ICONS[area] ?? ShieldIcon;
  return <Glyph className={className} />;
}

/** What each permission lets someone do, in plain words. Keyed by catalog id. */
export const PERMISSION_HINTS: Record<string, string> = {
  "workspace.view": "Open the workspace and see its details.",
  "workspace.edit": "Rename it and change its icon, colour or description.",
  "workspace.delete": "Permanently delete the whole workspace.",
  "members.view": "See who is in the workspace.",
  "members.invite": "Send invitations to new people.",
  "members.remove": "Remove people from the workspace.",
  "members.roles": "Change which role each member has.",
  "projects.view": "Browse every project in the workspace.",
  "projects.create": "Start new projects.",
  "projects.manage": "Edit, archive or delete any project, even ones they are not on.",
  "tasks.work": "Create, edit and move cards on every project's backlog and sprint board.",
  "roles.manage": "Create and edit roles like this one.",
};
