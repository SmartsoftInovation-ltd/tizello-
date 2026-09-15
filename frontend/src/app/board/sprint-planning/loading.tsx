const SKELETON_BOXES = ["sprint", "backlog"];

/**
 * Mirrors the real page's rhythm: the header block, the tabs strip, the filter
 * row, then a sprint box above the backlog box — same heights, so the switch to
 * content is not a jump.
 */
export default function SprintPlanningLoading() {
  return (
    <main className="w-full px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <div className="h-6 w-40 animate-pulse rounded-sm bg-surface-sunken" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-sm bg-surface-sunken" />
      </div>

      <div className="mt-6 h-8 animate-pulse border-b border-border" />
      <div className="mt-6 h-8 w-72 max-w-full animate-pulse rounded-sm bg-surface-sunken" />

      <div className="mt-4 space-y-3">
        {SKELETON_BOXES.map((id) => (
          <div key={id} className="h-44 animate-pulse rounded-lg bg-surface-sunken" />
        ))}
      </div>

      <span className="sr-only" role="status">
        Loading sprint planning
      </span>
    </main>
  );
}
