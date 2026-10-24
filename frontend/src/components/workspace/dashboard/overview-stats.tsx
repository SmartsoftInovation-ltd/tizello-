import { ClockIcon } from "@/components/ui/icons";
import type { WorkspaceOverview } from "@/lib/workspace-overview";

const number = (value: number) => value.toLocaleString("en-US");

/*
 * The dashboard's headline row: ONE hero figure and four small tiles.
 *
 * Open tasks is the hero — it is the number someone opening their workspaces
 * wants first ("how much is on our plate?"), and the dataviz rule is exactly
 * one hero per view. The tiles carry the context that makes it readable:
 * how much is already done, how much is late, how much is running right now,
 * and across how many projects.
 *
 * Figures use proportional digits (no `tabular-nums`): they stand alone at
 * display sizes, where equal-width digits make "121" look loose. Overdue is a
 * STATE, so it may wear the status colour — but only on its icon, with the
 * word beside it, never colour alone; its number stays in text ink.
 */
export function OverviewStats({ totals }: { totals: WorkspaceOverview["totals"] }) {
  const finished = totals.openTasks + totals.doneTasks;
  const donePercent = finished > 0 ? Math.round((totals.doneTasks / finished) * 100) : 0;

  return (
    <div className="grid gap-px overflow-hidden border-b border-border bg-border sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(4,1fr)]">
      <div className="bg-surface p-5 sm:col-span-2 lg:col-span-1">
        <p className="text-xs font-medium text-text-subtle">Open tasks</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight text-text">{number(totals.openTasks)}</p>
        <p className="mt-1 text-xs text-text-muted">
          across {number(totals.projects)} projects in {number(totals.workspaces)} workspaces
        </p>
      </div>

      <Tile label="Done" value={number(totals.doneTasks)} note={`${donePercent}% of all tasks`} />
      <Tile
        label="Overdue"
        value={number(totals.overdueTasks)}
        note="past their due date"
        icon={<ClockIcon className="size-3.5 text-warning" aria-hidden="true" />}
      />
      <Tile label="Active sprints" value={number(totals.activeSprints)} note="running now" />
      <Tile label="Projects" value={number(totals.projects)} note="not archived" />
    </div>
  );
}

function Tile({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-surface p-5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-text-subtle">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-text">{value}</p>
      <p className="mt-0.5 text-2xs text-text-subtle">{note}</p>
    </div>
  );
}
