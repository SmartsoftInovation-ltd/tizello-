const SKELETON_ROWS = ["a", "b", "c", "d"];

/** Mirrors the real page: heading, then two sections of rows. */
export default function TrashLoading() {
  return (
    <main className="w-full px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <div className="h-6 w-28 animate-pulse rounded-sm bg-surface-sunken" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-sm bg-surface-sunken" />
      </div>

      <div className="mt-8 h-3 w-20 animate-pulse rounded-sm bg-surface-sunken" />
      <div className="mt-3 space-y-2">
        {SKELETON_ROWS.map((id) => (
          <div key={id} className="h-11 w-full animate-pulse rounded-md bg-surface-sunken" />
        ))}
      </div>

      <span className="sr-only" role="status">
        Loading the trash
      </span>
    </main>
  );
}
