import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";

/**
 * Where the sprint boxes go when a project has none yet.
 *
 * Not just an absence: a first-time planner lands on a page that is only the
 * backlog, and nothing on it says what planning IS. This card names the three
 * steps in the order they happen and puts the first one under the thumb. It is
 * drawn as a dashed box in the sprint position, so the layout they are about to
 * get is already the layout they are looking at.
 */
export function NoSprintsCard({ canManage, onCreate }: { canManage: boolean; onCreate: () => void }) {
  return (
    <section
      aria-label="No sprints yet"
      className="rounded-lg border border-dashed border-border-strong px-4 py-8 text-center"
    >
      <p className="text-sm font-semibold text-text">No sprints yet</p>
      <ol className="mx-auto mt-2 max-w-md space-y-0.5 text-xs text-text-muted">
        <li>1. Create a sprint.</li>
        <li>2. Drag tasks into it from the backlog below, or use a task&rsquo;s ⋯ menu.</li>
        <li>3. Estimate them, then start the sprint.</li>
      </ol>
      {canManage ? (
        <Button size="sm" className="mt-4" onClick={onCreate}>
          <PlusIcon className="size-3.5" />
          Create sprint
        </Button>
      ) : (
        <p className="mt-3 text-2xs text-text-subtle">The project&rsquo;s owner or a manager creates sprints.</p>
      )}
    </section>
  );
}
