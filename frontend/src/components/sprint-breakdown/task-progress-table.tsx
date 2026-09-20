import { TaskAssignees } from "@/components/backlog/task-assignees";
import { TaskStatusChip } from "@/components/tasks/task-status-chip";
import { cn } from "@/lib/cn";
import { formatDeadline } from "@/lib/format-date";
import { statusStep } from "@/lib/sprint-breakdown";
import { taskDelayDays } from "@/lib/task-delay";
import type { Task, TaskStatusOption } from "@/types/task";

/*
 * Every task in the sprint as a row — how far each one has moved, who has it,
 * what it is worth and when it is due.
 *
 * THIS TABLE IS NOT AN EXTRA, IT IS THE CHART'S TWIN. Every number any of the
 * three charts draws is reachable here as real text, on every view, without
 * hovering anything. That is what lets the charts use the team's own status
 * colours — which are decorative `label-*` hues that no colour-blind reader can
 * reliably tell apart — without the colour ever being the only way to read a
 * value.
 *
 * PROGRESS IS A STEP, NOT A PERCENTAGE. `statusStep` explains why at length:
 * the record knows which stage a task has reached out of how many the team
 * defined, and nothing more. The meter beside it is that fraction, so it can
 * never disagree with the words next to it.
 */
export function TaskProgressTable({ tasks, statuses, today }: { tasks: Task[]; statuses: TaskStatusOption[]; today: string }) {
  return (
    <div className="scrollbar-hidden overflow-x-auto">
      <table className="w-full min-w-xl border-collapse text-sm">
        <caption className="sr-only">Every task in this sprint, with the stage it has reached, its assignees, story points and due date.</caption>
        <thead>
          <tr className="border-b border-border text-2xs font-semibold tracking-widest text-text-subtle uppercase">
            <th scope="col" className="py-2 pr-3 text-left font-semibold">Task</th>
            <th scope="col" className="px-3 py-2 text-left font-semibold">Status</th>
            <th scope="col" className="px-3 py-2 text-left font-semibold">Progress</th>
            <th scope="col" className="px-3 py-2 text-left font-semibold">Assignees</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Points</th>
            <th scope="col" className="py-2 pl-3 text-right font-semibold">Due</th>
          </tr>
        </thead>

        <tbody>
          {tasks.map((task) => {
            const { step, of } = statusStep(statuses, task.statusId);
            const delay = task.dueDate ? taskDelayDays({ dueDate: task.dueDate, completedAt: task.completedAt ?? "", today }) : null;
            const late = task.status.group !== "COMPLETE" && delay !== null && delay > 0;

            return (
              <tr key={task.id} className="border-b border-border last:border-b-0">
                <td className="max-w-xs py-2.5 pr-3">
                  <span className="block truncate text-text" title={task.title}>{task.title}</span>
                  <span className="font-mono text-2xs text-text-subtle">{task.key}</span>
                </td>

                <td className="px-3 py-2.5">
                  <TaskStatusChip status={task.status} />
                </td>

                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    {/* `aria-hidden`, because the fraction beside it says the
                        same thing in words — the house rule every progress
                        rail in this app follows. */}
                    <span aria-hidden="true" className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-surface-hover">
                      <span
                        className={cn("block h-full rounded-full", task.status.group === "COMPLETE" ? "bg-success" : "bg-brand-500")}
                        style={{ width: `${of === 0 ? 0 : (step / of) * 100}%` }}
                      />
                    </span>
                    <span className="text-xs text-text-muted tabular-nums">
                      {step}/{of}
                    </span>
                  </span>
                </td>

                <td className="px-3 py-2.5">
                  <TaskAssignees people={task.assignees.map((person) => ({ id: person.id, name: person.name ?? person.email }))} />
                </td>

                <td className="px-3 py-2.5 text-right text-text-muted tabular-nums">{task.storyPoints ?? "—"}</td>

                <td className={cn("py-2.5 pl-3 text-right text-xs tabular-nums", late ? "font-semibold text-warning" : "text-text-muted")}>
                  {task.dueDate ? formatDeadline(task.dueDate) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
