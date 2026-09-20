import { cn } from "@/lib/cn";
import type { MyTasksProgress } from "@/lib/my-tasks-groups";
import { TASK_STATUS_GROUP_LABEL, type TaskStatusGroup } from "@/types/task";

/*
 * How much of everything assigned to you is done — one segmented bar over the
 * whole list.
 *
 * THE SAME THREE SEGMENTS, IN THE SAME THREE COLOURS, AS THE SPRINT STRIP
 * (`current-sprint/sprint-progress.tsx`). Done / In progress / To do is the
 * split that means the same thing in every project, and someone who has
 * learned to read the board's bar reads this one without relearning it. A
 * second palette for the same three states would be a second thing to learn
 * that says nothing new.
 *
 * COUNTED IN TASKS, NOT POINTS — `assignedProgress` records why: a personal
 * list is answered "how many things are left", and unestimated work would
 * vanish from both sides of a points ratio.
 *
 * MEASURED OVER THE WHOLE LIST, never the filtered view. The bar under a Done
 * tab that read 100% would be measuring the filter rather than the work.
 *
 * `aria-hidden` on the bar with the same numbers as real text beside it — the
 * house rule every progress rail in this app follows. A screen reader gets the
 * sentence, not a geometry lesson.
 */
const SEGMENTS = [
  { key: "COMPLETE", fill: "bg-success" },
  { key: "IN_PROGRESS", fill: "bg-label-blue/70" },
  { key: "TODO", fill: "bg-border-strong" },
] as const satisfies readonly { key: TaskStatusGroup; fill: string }[];

export function MyTasksProgressBar({ progress }: { progress: MyTasksProgress }) {
  /* Nothing assigned is not 0% done — it is no ratio at all, and a full grey
     track under "0% done" reads as a pile of unfinished work that does not
     exist. The page's empty state says it in words instead. */
  if (progress.total === 0) return null;

  return (
    <section aria-label="Progress across your tasks" className="rounded-lg border border-border bg-panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-sm text-text-muted">
          <span className="text-lg font-semibold text-text tabular-nums">{progress.percent}%</span> done
        </p>
        <p className="text-xs text-text-muted tabular-nums">
          {progress.COMPLETE} of {progress.total} {progress.total === 1 ? "task" : "tasks"}
        </p>
      </div>

      {/* A 2px gap in the surface colour is what separates the segments —
          never a stroke around each, which would add ink that is not data. */}
      <div aria-hidden="true" className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-hover">
        {SEGMENTS.map(({ key, fill }) =>
          progress[key] > 0 ? (
            <span
              key={key}
              className={cn("first:rounded-l-full last:rounded-r-full", fill)}
              style={{ width: `${(progress[key] / progress.total) * 100}%` }}
            />
          ) : null,
        )}
      </div>

      {/* The legend is always present, because there are three series: identity
          is never colour alone. Each count is real text, so every number the
          bar draws is readable without it. */}
      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
        {SEGMENTS.map(({ key, fill }) => (
          <li key={key} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={cn("size-2 rounded-full", fill)} />
            {TASK_STATUS_GROUP_LABEL[key]}
            <span className="font-semibold text-text tabular-nums">{progress[key]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
