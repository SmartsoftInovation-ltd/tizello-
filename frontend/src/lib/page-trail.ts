/*
 * The breadcrumb trail for a pathname — what the content strip draws after the
 * Home icon. Pure, so it is testable without a router.
 *
 * Built from the URL alone, because the strip sits in the layout and has no
 * record to name a crumb after. That decides three rules:
 *
 *   - ID SEGMENTS ARE NEVER CRUMBS. "Cmtr4i04q…" is unreadable, so an id is
 *     skipped — except as the LAST segment, where it names the page from its
 *     collection ("roles/<id>" → "Edit role").
 *   - SEGMENTS WITH NO PAGE ARE SKIPPED (`settings`, `roles`): a crumb that
 *     links to a 404 is worse than one fewer crumb.
 *   - Every crumb but the last links to its own path; the last is the page.
 *
 * `/workspaces` itself is omitted: Home already points there, and
 * "Home › Workspaces" would be one route written twice.
 */

export type Crumb = { label: string; href: string };

const SEGMENT_LABELS: Record<string, string> = {
  permissions: "Roles & permissions",
  "sprint-planning": "Sprint planning",
  sprint: "Sprint board",
  "my-tasks": "My tasks",
  new: "New",
};

/** Segments that exist only to group routes beneath them — no page of their own. */
const NO_PAGE = new Set(["settings", "roles", "board"]);

/** Last-segment labels that depend on the collection they sit in. */
const IN_COLLECTION: Record<string, { new?: string; id?: string }> = {
  roles: { new: "New role", id: "Edit role" },
  projects: { id: "Project" },
  workspaces: { id: "Overview" },
};

const ID_SEGMENT = /^[a-z0-9]{16,}$/i;

const humanise = (segment: string) =>
  segment.replace(/-/g, " ").replace(/(^|\s)\S/g, (character) => character.toUpperCase());

export function pageTrail(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];

  segments.forEach((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const isLast = index === segments.length - 1;
    const parent = segments[index - 1] ?? "";
    const isId = ID_SEGMENT.test(segment);

    if (href === "/workspaces") return;

    if (isLast) {
      const special = IN_COLLECTION[parent];
      if (isId) return crumbs.push({ label: special?.id ?? humanise(parent).replace(/s$/, ""), href });
      if (segment === "new" && special?.new) return crumbs.push({ label: special.new, href });
    }

    if (isId || NO_PAGE.has(segment)) return;
    crumbs.push({ label: SEGMENT_LABELS[segment] ?? humanise(segment), href });
  });

  return crumbs;
}
