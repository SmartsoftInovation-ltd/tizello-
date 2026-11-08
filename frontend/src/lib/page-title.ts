/*
 * The name a route goes by in the chrome — read by the in-column
 * breadcrumb (`breadcrumb.tsx`). The content strip builds its own trail from
 * the URL in `page-trail.ts`.
 *
 * Known routes take the name the nav uses. A dynamic segment has no entry and
 * is humanised from the slug instead: "atlas-robotics" reads as "Atlas
 * Robotics" without threading the record's name down through the layout.
 */

const PAGE_LABELS: Record<string, string> = {
  "/workspaces": "Workspaces",
  "/profile": "Profile",
  "/board/backlog": "Backlog",
  "/board/sprint": "Sprint board",
};

function humanise(segment: string) {
  return segment
    .replace(/-/g, " ")
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}

/* cuid — what every id in this app is. Long enough that no real slug segment
   collides with it. */
const ID_SEGMENT = /^[a-z0-9]{16,}$/i;

/**
 * `/workspaces/:id` ends on an id, so the last segment cannot be the label
 * there: it would read as "Cmtr4i04q0003rcj27ut25z6s". The collection it came
 * out of names it instead — "workspaces" → "Workspace" — and the page's own
 * heading carries the record's actual name.
 */
export function pageTitleFor(pathname: string): string {
  const known = PAGE_LABELS[pathname];
  if (known) return known;

  const segments = pathname.split("/").filter(Boolean);
  const last = segments.at(-1);
  if (!last) return "Tizello";
  if (!ID_SEGMENT.test(last)) return humanise(last);

  const collection = segments.at(-2);
  return collection ? humanise(collection).replace(/s$/, "") : "Tizello";
}
