const SKELETON_ROWS = ["a", "b", "c", "d", "e"];

/**
 * Mirrors the real page's rhythm — heading, the tabs strip, then the chart
 * card above the table card — so the switch to content is not a jump.
 *
 * Its own file rather than inheriting `/board/sprint`'s: that skeleton draws a
 * rail of board columns, which is the wrong shape for a document that scrolls.
 */
export default function SprintBreakdownLoading() {
  return (
    <main className="w-full px-4 py-8 sm:px-6">
      <div className="h-6 w-48 animate-pulse rounded-sm bg-surface-sunken" />
      <div className="mt-6 h-8 animate-pulse border-b border-border" />

      <div className="mt-4 rounded-lg border border-border bg-surface p-6">
        <div className="h-4 w-56 animate-pulse rounded-sm bg-surface-sunken" />
        <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
          <div className="size-44 shrink-0 animate-pulse rounded-full bg-surface-sunken" />
          <div className="w-full max-w-md space-y-3">
            {SKELETON_ROWS.map((id) => (
              <div key={id} className="h-4 w-full animate-pulse rounded-sm bg-surface-sunken" />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-surface p-6">
        <div className="h-4 w-32 animate-pulse rounded-sm bg-surface-sunken" />
        <div className="mt-4 space-y-3">
          {SKELETON_ROWS.map((id) => (
            <div key={id} className="h-6 w-full animate-pulse rounded-sm bg-surface-sunken" />
          ))}
        </div>
      </div>

      <span className="sr-only" role="status">
        Loading the sprint breakdown
      </span>
    </main>
  );
}
