const SKELETON_COLUMNS = ["a", "b", "c", "d"];

/**
 * Mirrors the real page's rhythm: header block, the tabs strip, the sprint
 * header and filter row, then a rail of columns at the real column width —
 * so the switch to content is not a jump.
 */
export default function CurrentSprintLoading() {
  return (
    <main className="w-full px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <div className="h-6 w-40 animate-pulse rounded-sm bg-surface-sunken" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-sm bg-surface-sunken" />
      </div>

      <div className="mt-6 h-8 animate-pulse border-b border-border" />
      <div className="mt-6 h-12 w-80 max-w-full animate-pulse rounded-sm bg-surface-sunken" />
      <div className="mt-3 h-8 w-72 max-w-full animate-pulse rounded-sm bg-surface-sunken" />

      <div className="mt-4 flex gap-3 overflow-hidden">
        {SKELETON_COLUMNS.map((id) => (
          <div key={id} className="h-96 w-list shrink-0 animate-pulse rounded-lg bg-surface-sunken" />
        ))}
      </div>

      <span className="sr-only" role="status">
        Loading the sprint board
      </span>
    </main>
  );
}
