import { MyTasksGroup } from "@/components/my-tasks/my-tasks-group";
import { MyTasksEmpty } from "@/components/my-tasks/my-tasks-empty";
import { MyTasksProgressBar } from "@/components/my-tasks/my-tasks-progress";
import { MyTasksTabs } from "@/components/my-tasks/my-tasks-tabs";
import { ClockIcon } from "@/components/ui/icons";
import { assignedProgress, filterByState, groupByDue, overdueCount } from "@/lib/my-tasks-groups";
import type { AssignedState, AssignedTask } from "@/types/task";

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

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <MyTasksTabs
          state={state}
          counts={{
            open: filterByState(tasks, "open").length,
            done: filterByState(tasks, "done").length,
            all: tasks.length,
          }}
        />

        {/* The one number worth saying before the list — and only when it is
            not zero: "0 overdue" is a reassurance nobody asked for. */}
        {overdue > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-subtle px-2.5 py-1 text-xs font-semibold text-warning tabular-nums">
            <ClockIcon className="size-3.5" />
            {overdue} overdue
          </span>
        )}
      </div>

      {groups.length === 0 ? (
        <MyTasksEmpty state={state} />
      ) : (
        <div className="mt-4 space-y-4">
          {groups.map((group) => (
            <MyTasksGroup key={group.bucket} bucket={group.bucket} tasks={group.tasks} today={today} />
          ))}
        </div>
      )}
    </div>
  );
}
