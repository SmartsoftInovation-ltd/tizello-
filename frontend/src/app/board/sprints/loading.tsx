const SKELETON_BANDS = ["a", "b", "c"];

/**
 * Mirrors the real page's rhythm: header, the tabs strip, the count line, then
 * three state bands each holding a card — so the switch to content is not a
 * jump.
 */
export default function BoardSprintsLoading() {
  return (
    <main className="w-full px-4 py-8 sm:px-6">
      <div className="h-6 w-32 animate-pulse rounded-sm bg-surface-sunken" />

      <div className="mt-6 h-8 animate-pulse border-b border-border" />
      <div className="mt-4 h-4 w-64 max-w-full animate-pulse rounded-sm bg-surface-sunken" />

      {SKELETON_BANDS.map((id) => (
        <div key={id} className="mt-6 space-y-2">
          <div className="h-3 w-24 animate-pulse rounded-sm bg-surface-sunken" />
          <div className="h-24 w-full animate-pulse rounded-md bg-surface-sunken" />
        </div>
      ))}

      <span className="sr-only" role="status">
        Loading this project&rsquo;s sprints
      </span>
    </main>
  );
}
