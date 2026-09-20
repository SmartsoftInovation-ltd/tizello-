import { SHELL_SECTIONS } from "@/lib/nav-apps";
import { DEFAULT_PROJECT_VIEW, PROJECT_VIEW_LABEL } from "@/lib/project-view";
import type {
  SidebarChildItem,
  SidebarItem,
  SidebarSection,
} from "@/types/nav";
import { PROJECT_VIEWS } from "@/types/project";

/*
 * The sidebar's destinations, following the product flow in
 * `.claude/plan/applicaton-flow.md`:
 *
 *   Workspace → Members → Projects → Backlog → Sprint → Sprint planning
 *   → Columns → Sprint board → Tasks
 *
 * Only `/workspaces`, `/workspaces/[workspaceId]`,
 * `/workspaces/[workspaceId]/projects`, `/workspaces/[workspaceId]/members`,
 * `/workspaces/[workspaceId]/settings/permissions`, `/board/backlog` and
 * `/board/sprint` exist. Everything else is listed WITHOUT an `href`, which
 * renders it disabled — the flow stays visible without emitting a dead link.
 */

/*
 * TEMPORARY — design review only.
 *
 * Projects and Members are workspace-scoped and Sprints / Sprint planning are
 * project-scoped, so from `/board/*` there is nothing to scope them to and they
 * all render disabled. While the UI is being designed every section has to be
 * reachable, so an unscoped item falls back to a fixture workspace and project
 * rather than going dead. Delete these two constants and the fallbacks in
 * `resolveHref` once the shell can hold a real project.
 */
const DEMO_WORKSPACE_ID = "atlas-robotics";

/*
 * The projects page's five `?view=` screens, mirrored under the sidebar's
 * Projects item so the group expands to exactly what the page's view strip
 * offers — the same URLs, so a sidebar click and a strip click are the same
 * navigation.
 *
 * Derived from `PROJECT_VIEWS` rather than written out: a sixth view added to
 * the page appears here without a second edit. The default view is written
 * WITHOUT the param (see `projectsHref`), so it carries no `param` here either.
 */
const PROJECT_VIEW_CHILDREN: readonly SidebarChildItem[] = PROJECT_VIEWS.map(
  (view) => ({
    id: `projects-${view}`,
    label: PROJECT_VIEW_LABEL[view],
    param:
      view === DEFAULT_PROJECT_VIEW ? undefined : { name: "view", value: view },
  }),
);

/*
 * The three screens under Sprint board.
 *
 * **They are project-scoped and the sidebar has no project**, which is the
 * whole difficulty. `resolveHref` solves the same problem for workspace-scoped
 * ITEMS by reading the id out of the pathname; a child cannot do that, because
 * this list is built once at module scope and a child carries a literal href.
 *
 * So each points at a `/board/*` screen that picks its own project from
 * `?project=` (falling back to the remembered workspace's first project) —
 * `/board/backlog` and `/board/sprint-planning` do; `/board/sprint` is still the
 * fixture board.
 *
 * `Current sprint` points at `/board/sprint`, the same place the parent does.
 * That is deliberate: the parent is the group's name AND its default screen,
 * and the child is what marks it current once the group is open.
 * `SidebarTreeItem` already hands `aria-current` down to the child for exactly
 * this reason.
 *
 * **Three, and the sprint LIST is not one of them.** These are the screens of a
 * sprint in flight — plan it, work it, and the pool the unplanned work sits in
 * — which is the workflow in `.claude/rules/workflow.md`. `/sprints` is the
 * administrative list of every sprint a project has ever had: a different job,
 * visited when a sprint is created or closed rather than during one, and it is
 * still reachable from the project itself. Putting it here made the group read
 * as "everything with the word sprint in it" instead of as one workflow.
 */
export const PLANNING_CHILDREN: readonly SidebarChildItem[] = [
  { id: "current-sprint", label: "Current sprint", href: "/board/sprint" },
  {
    id: "sprint-breakdown",
    label: "Breakdown",
    /* The running sprint measured rather than worked — status share, workload
       per person, and the timeline. It sits directly under Current sprint
       because it is a lens on that same sprint, not a fourth stage of the
       workflow: everything it draws is the board's own tasks, read-only. */
    href: "/board/sprint/breakdown",
  },
  {
    id: "sprint-planning",
    label: "Sprint planning",
    /* The real planning screen, which picks its project from `?project=` the
       way `/board/backlog` does — so it no longer needs the fixture ids. */
    href: "/board/sprint-planning",
  },
  { id: "backlog", label: "Backlog", href: "/board/backlog" },
];

export const PRIMARY_ITEMS: readonly SidebarItem[] = [
  { id: "home", label: "Home", icon: "home", href: "/workspaces" },
  /* No `href`: Search opens the ⌘K palette rather than a route, so
     `SidebarNav` renders it through `SearchSidebarItem`. It carries no `hint`
     either — a hint is what marks a row as unavailable, and this one works. */
  { id: "search", label: "Search", icon: "search" },
];

export const SIDEBAR_SECTIONS: readonly SidebarSection[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      {
        id: "projects",
        label: "Projects",
        icon: "projects",
        workspaceScoped: true,
        workspaceSegment: "/projects",
        hint: "Open a workspace to see its projects",
        children: PROJECT_VIEW_CHILDREN,
      },
      {
        id: "members",
        label: "Members",
        icon: "members",
        workspaceScoped: true,
        workspaceSegment: "/members",
        hint: "Open a workspace to see its members",
      },
      {
        id: "permissions",
        label: "Roles & permissions",
        icon: "permissions",
        workspaceScoped: true,
        workspaceSegment: "/settings/permissions",
        hint: "Open a workspace to see its roles",
      },
    ],
  },
  {
    id: "planning",
    label: "Planning",
    items: [
      /*
       * ONE GROUP, NOT FOUR SIBLINGS. These four rows are the sprint workflow
       * in `.claude/rules/workflow.md` — backlog, plan, run, and the sprints
       * behind it — and listing them flat said nothing about that. As a
       * disclosure under Sprint board the shape says it: one thing you do, and
       * the screens it is done on.
       *
       * The parent is the board rather than a heading of its own because it is
       * the screen the workflow lives on — the one somebody returns to daily —
       * and a group whose parent is not clickable makes the most-visited screen
       * the hardest to reach.
       *
       * The children are ROUTES, not `?view=` params like Projects': these are
       * four separate pages, not four views of one. `SidebarChildItem` carries
       * either shape; see `types/nav.ts`.
       */
      {
        id: "sprint-board",
        label: "Sprint board",
        icon: "sprint",
        href: "/board/sprint",
        children: PLANNING_CHILDREN,
      },
    ],
  },
  ...SHELL_SECTIONS,
];

/**
 * The workspace id in a path, when the path is a workspace route.
 * `/workspaces/atlas-robotics` → `"atlas-robotics"`; `/workspaces` → undefined.
 */
export function workspaceIdFromPath(pathname: string): string | undefined {
  return /^\/workspaces\/([^/]+)/.exec(pathname)?.[1];
}

/**
 * An item's destination. `undefined` is the signal to render it disabled, which
 * covers both "no route exists yet" and "this item needs an open workspace and
 * there isn't one".
 */
export function resolveHref(
  item: SidebarItem,
  workspaceId?: string,
): string | undefined {
  if (!item.workspaceScoped) return item.href;
  /* TEMP: no open workspace used to mean "render disabled". See the note on
     DEMO_WORKSPACE_ID above. */
  const id = workspaceId ?? DEMO_WORKSPACE_ID;
  return `/workspaces/${id}${item.workspaceSegment ?? ""}`;
}

/**
 * A child's destination: the parent's href plus the one param the child
 * selects. No parent href carries a query of its own, so `?` is always the
 * right joiner.
 */
export function childHref(parentHref: string, child: SidebarChildItem): string {
  if (!child.param) return parentHref;
  return `${parentHref}?${child.param.name}=${child.param.value}`;
}
