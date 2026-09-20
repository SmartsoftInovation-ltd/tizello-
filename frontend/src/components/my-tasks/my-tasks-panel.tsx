import Link from "next/link";
import { MyTaskRow } from "@/components/my-tasks/my-task-row";
import { MyTasksProgressBar } from "@/components/my-tasks/my-tasks-progress";
import { assignedProgress, DUE_BUCKET_LABEL, filterByState, groupByDue, overdueCount } from "@/lib/my-tasks-groups";
import { ASSIGNED_STATES, ASSIGNED_STATE_LABEL, type AssignedState, type AssignedTask } from "@/types/task";

/*
 * "My tasks": everything assigned to the signed-in person, from every project
 * they can still see, bucketed by when it is due.
 *
 * A SERVER COMPONENT, and the screen ships no JavaScript: the one control is
 * the state filter, and that is three links rather than a toggle — so the
 * choice survives a reload and pastes into a message. The same bargain
 * `ProjectsViewNav` and the breakdown's chart strip make.
 *
 * READ-ONLY on purpose — see `my-task-row.tsx`. A list spanning six projects
 * cannot offer "next status" without deciding what that means in six different
 * workflows, and the board already knows.
 *
 * `tasks` IS EVERY ASSIGNED TASK, whatever tab is selected: the progress bar
 * measures all of it and the list below shows the tab's slice. Filtering on
 * the server instead would make the bar read 100% under the Done tab — the
 * filter measuring itself.
 */
export function MyTasksPanel({ tasks, state, today }: { tasks: AssignedTask[]; state: AssignedState; today: string }) {
  const progress = assignedProgress(tasks);
  const shown = filterByState(tasks, state);
  const groups = groupByDue(shown, today);
  /* Overdue is counted over the OPEN work, not the tab: a finished task is
     never overdue (`dueBucket`), so the number is the same under every tab —
     which is right, because it is a warning about your workload, not about
     what you happen to be looking at. */
  const overdue = overdueCount(tasks, today);

  return (
    <div className="mt-4">
      <MyTasksProgressBar progress={progress} />

      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="text-xs text-text-muted tabular-nums">
          {shown.length} {shown.length === 1 ? "task" : "tasks"}
          {/* The one number worth saying before the list — and only when it is
              not zero, because "0 overdue" is a reassurance nobody asked for
              taking up the same room as a warning. */}
          {overdue > 0 && (
            <>
              {" · "}
              <span className="font-semibold text-warning">{overdue} overdue</span>
            </>
          )}
        </p>

        <nav aria-label="Which tasks" className="flex items-center gap-1">
          {ASSIGNED_STATES.map((option) => (
            <Link
              key={option}
              href={option === "open" ? "/my-tasks" : `/my-tasks?state=${option}`}
              aria-current={option === state ? "page" : undefined}
              className={
                option === state
                  ? "rounded-sm bg-surface-hover px-2 py-1 text-xs font-semibold text-text"
                  : "rounded-sm px-2 py-1 text-xs font-medium text-text-muted transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
              }
            >
              {ASSIGNED_STATE_LABEL[option]}
            </Link>
          ))}
        </nav>
      </div>

      {groups.length === 0 ? (
        <Empty state={state} />
      ) : (
        <div className="mt-2">
          {groups.map((group) => (
            <section key={group.bucket} className="mt-5 first:mt-2">
              <h2 className="flex items-baseline gap-2 border-b border-border px-2 pb-1.5">
                <span
                  className={
                    group.bucket === "overdue"
                      ? "text-2xs font-semibold tracking-widest text-warning uppercase"
                      : "text-2xs font-semibold tracking-widest text-text-subtle uppercase"
                  }
                >
                  {DUE_BUCKET_LABEL[group.bucket]}
                </span>
                <span className="text-2xs text-text-subtle tabular-nums">{group.tasks.length}</span>
              </h2>

              <ul>
                {group.tasks.map((task) => (
                  <MyTaskRow key={task.id} task={task} today={today} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Three different empties, because they mean three different things: nothing
 * assigned, nothing finished yet, and nothing at all. One message for all
 * three would be wrong twice.
 */
function Empty({ state }: { state: AssignedState }) {
  const line =
    state === "done"
      ? "Nothing finished yet. Work you complete shows up here."
      : state === "all"
        ? "Nothing is assigned to you in any project you can see."
        : "Nothing on your plate. Anything assigned to you lands here.";

  return (
    <div className="mt-6 rounded-lg border border-dashed border-border bg-panel px-4 py-12 text-center">
      <p className="text-sm font-semibold text-text">All clear</p>
      <p className="mt-1 text-xs text-text-muted">{line}</p>
    </div>
  );
}
