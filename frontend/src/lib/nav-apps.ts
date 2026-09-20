import type { SidebarSection } from "@/types/nav";

/*
 * The tail of the sidebar: the companion apps, then the utility rows.
 *
 * Nothing here is a route in this package — a calendar client and a desktop
 * shell are separate products, and the rest are screens that do not exist yet
 * — so every item is listed WITHOUT an href. `SidebarItem` then renders it as
 * a genuinely disabled button carrying its reason as a `title` and a "Soon"
 * badge, which is the honest shape for "coming soon": visible, explained, and
 * not a dead link.
 *
 * Its own file because `nav-links.ts` would pass the 150-line cap.
 */
export const SHELL_SECTIONS: readonly SidebarSection[] = [
  {
    id: "apps",
    label: "Tizello apps",
    items: [
      {
        id: "tizello-calendar",
        label: "Tizello Calendar",
        icon: "calendar",
        hint: "Tizello Calendar is coming soon",
      },
      {
        id: "tizello-desktop",
        label: "Tizello Desktop",
        icon: "desktop",
        hint: "Tizello Desktop is coming soon",
      },
    ],
  },
  /* The utility rows at the foot of the nav. Same treatment, same reason: none
     of these screens exist yet, so none of them emit a link. */
  {
    id: "more",
    label: "More",
    items: [
      {
        id: "my-tasks",
        label: "My tasks",
        icon: "tasks",
        /* The one screen here that is not workspace- or project-scoped: it is
           everything assigned to YOU, wherever it lives, so it carries no
           `?project=` and needs nothing resolved from the path. */
        href: "/my-tasks",
      },
      {
        id: "templates",
        label: "Templates",
        icon: "templates",
        hint: "The template library is not built yet",
      },
      {
        id: "marketplace",
        label: "Marketplace",
        icon: "marketplace",
        hint: "The marketplace is not built yet",
      },
      {
        id: "help",
        label: "Help",
        icon: "help",
        hint: "Help is not built yet",
      },
      {
        id: "trash",
        label: "Trash",
        icon: "trash",
        /* Like My tasks, and unlike everything under Workspace: the trash
           spans every workspace the caller is in, because someone looking for
           what they deleted usually cannot remember where it was. */
        href: "/trash",
      },
    ],
  },
];
