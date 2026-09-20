const SKELETON_ROWS = ["a", "b", "c", "d", "e", "f"];

/**
 * Mirrors the real page's rhythm — heading, the count-and-filter row, then
 * rows under a section heading — so the switch to content is not a jump.
 */
export default function MyTasksLoading() {
  return (
    <main className="w-full px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <div className="h-6 w-40 animate-pulse rounded-sm bg-surface-sunken" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-sm bg-surface-sunken" />
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <div className="h-4 w-24 animate-pulse rounded-sm bg-surface-sunken" />
        <div className="h-6 w-48 animate-pulse rounded-sm bg-surface-sunken" />
      </div>

      <div className="mt-6 h-3 w-20 animate-pulse rounded-sm bg-surface-sunken" />
      <div className="mt-3 space-y-2">
        {SKELETON_ROWS.map((id) => (
          <div key={id} className="h-11 w-full animate-pulse rounded-md bg-surface-sunken" />
        ))}
      </div>

      <span className="sr-only" role="status">
        Loading your tasks
      </span>
    </main>
  );
}
