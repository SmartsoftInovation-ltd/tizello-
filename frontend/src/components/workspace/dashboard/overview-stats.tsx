import { TasksIcon } from "@/components/ui/app-icons";
import { CheckIcon, ClockIcon, type IconProps } from "@/components/ui/icons";
import { ProjectsIcon, SprintIcon } from "@/components/ui/nav-icons";
import { cn } from "@/lib/cn";
import type { WorkspaceOverview } from "@/lib/workspace-overview";

const number = (value: number) => value.toLocaleString("en-US");

/*
 * The dashboard's headline row: five tiles, each with a tinted icon that says
 * what it counts at a glance and a one-line note that says what the number
 * means. Done carries a thin completion bar; Active sprints says how many of
 * the projects have one running.
 *
 * Tones come from complete class strings in `TONE` — Tailwind cannot see an
 * interpolated class. Colour is recognition only: every tile has its label.
 */
type Tone = "brand" | "success" | "danger" | "accent" | "info";

const TONE: Record<Tone, string> = {
  brand: "bg-brand-subtle text-text-brand",
  success: "bg-success-subtle text-success",
  danger: "bg-danger-subtle text-danger",
  accent: "bg-accent-subtle text-accent",
  info: "bg-info-subtle text-info",
};

export function OverviewStats({
  totals,
  projectsWithSprint,
}: {
  totals: WorkspaceOverview["totals"];
  /** Distinct projects with a running sprint. */
  projectsWithSprint: number;
}) {
  const all = totals.openTasks + totals.doneTasks;
  const donePercent = all > 0 ? Math.round((totals.doneTasks / all) * 100) : 0;

  return (
    <div className="grid gap-px overflow-hidden border-b border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
      <Tile tone="brand" Glyph={TasksIcon} label="Open tasks" value={number(totals.openTasks)}>
        across {number(totals.projects)} projects in {number(totals.workspaces)} workspaces
      </Tile>

      <Tile tone="success" Glyph={CheckIcon} label="Done" value={number(totals.doneTasks)}>
        <span className="flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
            <span className="block h-full rounded-full bg-success" style={{ width: `${donePercent}%` }} />
          </span>
          <span className="tabular-nums">{donePercent}%</span>
        </span>
      </Tile>

      <Tile tone="danger" Glyph={ClockIcon} label="Overdue" value={number(totals.overdueTasks)} alert={totals.overdueTasks > 0}>
        past their due date
      </Tile>

      <Tile tone="accent" Glyph={SprintIcon} label="Active sprints" value={number(totals.activeSprints)}>
        running in {number(projectsWithSprint)} of {number(totals.projects)} projects
      </Tile>

      <Tile tone="info" Glyph={ProjectsIcon} label="Projects" value={number(totals.projects)}>
        not archived
      </Tile>
    </div>
  );
}

function Tile({
  tone,
  Glyph,
  label,
  value,
  alert = false,
  children,
}: {
  tone: Tone;
  Glyph: (props: IconProps) => React.ReactNode;
  label: string;
  value: string;
  alert?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 bg-surface p-5">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", TONE[tone])}>
        <Glyph className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-text-subtle">{label}</p>
        <p className={cn("mt-0.5 text-2xl font-semibold tracking-tight tabular-nums", alert ? "text-danger" : "text-text")}>
          {value}
        </p>
        <div className="mt-1 text-2xs text-text-subtle">{children}</div>
      </div>
    </div>
  );
}
