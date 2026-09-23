import {
  CalendarIcon,
  DesktopIcon,
  HelpIcon,
  MarketplaceIcon,
  ShieldIcon,
  TasksIcon,
  TemplatesIcon,
} from "@/components/ui/app-icons";
import { TrashIcon } from "@/components/ui/icons";
import {
  BacklogIcon,
  ChatIcon,
  HomeIcon,
  MembersIcon,
  PlanningIcon,
  ProjectsIcon,
  SearchIcon,
  SprintIcon,
} from "@/components/ui/nav-icons";
import type { SidebarIconName } from "@/types/nav";

/*
 * Name → glyph. Nav data crosses the server/client boundary as plain props, so
 * a component cannot travel with it; this is the client-side half of that
 * split. A complete `Record` rather than a lookup with a fallback, so adding an
 * icon name without drawing it is a type error.
 */
export const SIDEBAR_ICON: Record<
  SidebarIconName,
  React.ComponentType<{ className?: string }>
> = {
  home: HomeIcon,
  search: SearchIcon,
  chat: ChatIcon,
  projects: ProjectsIcon,
  members: MembersIcon,
  permissions: ShieldIcon,
  backlog: BacklogIcon,
  sprint: SprintIcon,
  planning: PlanningIcon,
  calendar: CalendarIcon,
  desktop: DesktopIcon,
  tasks: TasksIcon,
  templates: TemplatesIcon,
  marketplace: MarketplaceIcon,
  help: HelpIcon,
  trash: TrashIcon,
};
