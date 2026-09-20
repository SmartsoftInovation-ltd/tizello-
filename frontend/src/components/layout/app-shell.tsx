import { AppSidebar } from "@/components/layout/app-sidebar";
import { ContentStrip } from "@/components/layout/content-strip";
import { SidebarFrame } from "@/components/layout/sidebar-frame";
import { SearchPalette } from "@/components/search/search-palette";

/**
 * The application shell: a persistent left sidebar and a content column.
 *
 * Applied through `layout.tsx` — one under `/workspaces`, one under `/board` —
 * rather than rendered by each page, so navigating between the two routes never
 * tears the sidebar down. `(auth)` has its own split shell and is not wrapped
 * by this one; neither is `/`, the design-system reference.
 *
 * Everything here is a Server Component. The only parts that ship JavaScript
 * are the collapse frame, the nav list and the small controls in the strip.
 *
 * NOTHING HERE SCROLLS EXCEPT THE CONTENT COLUMN, and each piece of that is
 * load-bearing:
 *
 * - `h-dvh overflow-hidden` on the root pins the shell to the viewport, so the
 *   document itself can never gain a scrollbar. Without the clip, anything
 *   that overflows — a wide table, a tall panel — grows `<body>` (which is
 *   `min-h-full`) and takes the top strip up with it, which is exactly the bug
 *   this replaces. The root used to be deliberately unclipped so the workspace
 *   switcher's menu could escape the sidebar's width; that stopped being a
 *   reason when `DropdownMenuContent` moved to a `document.body` portal with
 *   `position: fixed`, so no menu is inside this box any more.
 * - `shrink-0` on the sidebar and on `ContentStrip` is what keeps them at
 *   their own size instead of being squeezed by a tall child.
 * - `min-h-0` on the scroll region is what lets it be SHORTER than its
 *   content. A flex item's default `min-height: auto` floors it at the
 *   content's height, so `overflow-y-auto` would have nothing to scroll and
 *   the overflow would push out of the shell instead.
 * - `scrollbar-gutter: stable` reserves the vertical scrollbar's track whether
 *   or not there is one to draw, and its absence was the projects board's
 *   shake. A kanban column changes height as a card enters or leaves it, so a
 *   drag repeatedly crossed the threshold where this region overflows; each
 *   crossing added or removed a ~15px scrollbar, which changed the CONTENT
 *   WIDTH, which moved the board's horizontal scroll and the card under the
 *   cursor with it — re-running the collision that started the move, every
 *   frame. Reserving the gutter means appearing and disappearing costs no
 *   layout, so the loop has nothing to feed on. It applies to every page in
 *   the shell, which is right: nothing should reflow sideways because it grew.
 *
 * The sidebar has the same arrangement one level down: `AppSidebar` pins the
 * switcher and gives `SidebarNav` the scroll region, so a long nav scrolls
 * inside the column rather than moving it.
 *
 * A PAGE'S OWN HEADING PINS ITSELF, one level further down again: `PageTop`
 * sticks it to the top of the scroll region this component provides. The board
 * screens do it structurally instead (a fixed header over columns that scroll
 * individually), which is why this is a page's choice rather than something
 * imposed here.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <SidebarFrame>
        <AppSidebar />
      </SidebarFrame>

      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        <ContentStrip />
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          {children}
        </div>
      </div>

      {/* Mounted once for the whole shell: it is opened from the sidebar row
          and from ⌘K anywhere, and a `<dialog>` in the top layer does not care
          where in the tree it lives. */}
      <SearchPalette />
    </div>
  );
}
