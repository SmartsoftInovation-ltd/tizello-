import Link from "next/link";
import { SprintIcon } from "@/components/ui/nav-icons";
import { cn } from "@/lib/cn";
import { daysRemaining } from "@/lib/sprint-dates";
import { todayIso } from "@/lib/today";
import type { OverviewSprint } from "@/lib/workspace-overview";

/*
 * Every running sprint, one row per project: which project, which sprint, how
 * far through its cards it is, and how long is left — soonest deadline first
 * (the API's order). Each row opens that project's sprint board.
 *
 * Days left uses the sprint board's own tones: red on the last day or late,
 * warning inside three days, muted otherwise. Scrolls inside itself past ten
 * rows so a workspace with sixty sprints does not push the rest of the page
 * off the screen.
 */
function deadline(endDate: string | null, today: string) {
  if (!endDate) return { text: "No end date", tone: "text-text-subtle" };
  const left = daysRemaining(today, endDate.slice(0, 10));
  if (left < 1) return { text: `${1 - left}d overdue`, tone: "text-danger font-semibold" };
  if (left === 1) return { text: "Last day", tone: "text-danger font-semibold" };
  return { text: `${left}d left`, tone: left <= 3 ? "text-warning font-semibold" : "text-text-muted" };
}

export function ActiveSprintsPanel({ sprints }: { sprints: OverviewSprint[] }) {
  const today = todayIso();

  return (
    <section aria-labelledby="active-sprints-title" className="p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="active-sprints-title" className="flex items-center gap-2 text-sm font-semibold text-text">
          <SprintIcon className="size-4 text-accent" />
          Running sprints by project
        </h2>
        <span className="text-xs text-text-subtle tabular-nums">{sprints.length} running</span>
      </div>

      {sprints.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">No sprint is running in any project.</p>
      ) : (
        <ul className="scrollbar-board mt-3 max-h-[26rem] divide-y divide-border overflow-y-auto pr-1">
          {sprints.map((sprint) => {
            const percent = sprint.total > 0 ? Math.round((sprint.done / sprint.total) * 100) : 0;
            const due = deadline(sprint.endDate, today);

            return (
              <li key={sprint.id}>
                <Link
                  href={`/board/sprint?project=${encodeURIComponent(sprint.projectId)}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 rounded-sm px-1 py-2.5 transition-colors duration-100 ease-standard hover:bg-surface-hover sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_5.5rem]"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="shrink-0 rounded-sm bg-accent-subtle px-1.5 py-0.5 font-mono text-2xs font-semibold text-accent">
                      {sprint.projectKey}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-text">{sprint.projectName}</span>
                      <span className="block truncate text-2xs text-text-subtle">
                        {sprint.name} · {sprint.workspaceName}
                      </span>
                    </span>
                  </span>

                  <span className="col-span-2 row-start-2 flex items-center gap-2 sm:col-span-1 sm:row-start-auto">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
                      <span className="block h-full rounded-full bg-success" style={{ width: `${percent}%` }} />
                    </span>
                    <span className="w-16 shrink-0 text-right text-2xs text-text-muted tabular-nums">
                      {sprint.done}/{sprint.total} · {percent}%
                    </span>
                  </span>

                  <span className={cn("text-right text-xs tabular-nums", due.tone)}>{due.text}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
