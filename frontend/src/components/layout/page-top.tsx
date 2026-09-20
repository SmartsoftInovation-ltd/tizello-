import { cn } from "@/lib/cn";

/**
 * A page's own header, pinned to the top of the content column while the page
 * under it scrolls.
 *
 * The shell already pins the sidebar and the strip (`app-shell.tsx`), so the
 * only thing that still scrolled away was each page's heading — the one line
 * that says which project's backlog you are looking at, which is exactly what
 * you want on screen while scrolling a long list of its tasks.
 *
 * STICKY, NOT A SECOND SCROLL REGION. The alternative was to give every page a
 * fixed header and a separately scrolling body, the way `/board/sprint` is
 * built. That is right for the board, whose columns must each scroll inside
 * themselves, and wrong for a document: it would mean eleven pages restructured
 * into two nested flex boxes, and every one of them would then need `min-h-0`
 * in the right place or silently stop scrolling. `position: sticky` gets the
 * same result out of the scroll container the shell already provides.
 *
 * FULL BLEED. The pages carry `px-4 sm:px-6`, so the header cancels it with a
 * negative margin and re-applies it. Without that, the rule under the heading
 * would stop short of the column's edges, and content scrolling past would
 * show through the gap on both sides.
 *
 * `bg-surface` IS LOAD-BEARING, not decoration — it is what the content
 * scrolls *behind*. A transparent sticky header renders the page's rows
 * straight through the heading.
 *
 * `z-20` clears the bulk-selection bar (`sticky bottom-4 z-10`), which is the
 * only other sticky element in the app; the two never meet, but a header that
 * loses to a toolbar is a confusing thing to debug later.
 */
const EDGE = "-mx-4 px-4 sm:-mx-6 sm:px-6";

export function PageTop({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("sticky top-0 z-20 border-b border-border bg-surface pt-6 pb-4", EDGE, className)} {...props}>
      {children}
    </div>
  );
}
