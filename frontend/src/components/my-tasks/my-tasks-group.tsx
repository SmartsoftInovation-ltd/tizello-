import { MyTaskRow } from "@/components/my-tasks/my-task-row";
import { CalendarIcon } from "@/components/ui/app-icons";
import { ClockIcon, DashIcon, FlagIcon, type IconProps } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { DUE_BUCKET_LABEL, type DueBucket } from "@/lib/my-tasks-groups";
import type { AssignedTask } from "@/types/task";

/*
 * One due-date bucket of "My tasks" as a card: a header with the bucket's
 * icon, name and count, then its rows. Each bucket has its own tone so the
 * page reads at a glance — Overdue warns, Today is brand, the rest recede.
 * Tones are complete class strings (Tailwind cannot see interpolated ones).
 */
const BUCKET: Record<DueBucket, { Glyph: (props: IconProps) => React.ReactNode; tile: string; title: string }> = {
  overdue: { Glyph: ClockIcon, tile: "bg-warning-subtle text-warning", title: "text-warning" },
  today: { Glyph: FlagIcon, tile: "bg-brand-subtle text-text-brand", title: "text-text" },
  soon: { Glyph: CalendarIcon, tile: "bg-info-subtle text-info", title: "text-text" },
  later: { Glyph: CalendarIcon, tile: "bg-surface-sunken text-text-muted", title: "text-text" },
  someday: { Glyph: DashIcon, tile: "bg-surface-sunken text-text-subtle", title: "text-text-muted" },
};

export function MyTasksGroup({ bucket, tasks, today }: { bucket: DueBucket; tasks: AssignedTask[]; today: string }) {
  const { Glyph, tile, title } = BUCKET[bucket];
  const id = `my-tasks-${bucket}`;

  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-xl border border-border bg-surface">
      <h2 id={id} className="flex items-center gap-2.5 border-b border-border bg-surface-sunken px-4 py-2.5">
        <span className={cn("grid size-6 place-items-center rounded-md", tile)}>
          <Glyph className="size-3.5" />
        </span>
        <span className={cn("text-sm font-semibold", title)}>{DUE_BUCKET_LABEL[bucket]}</span>
        <span className="rounded-full bg-chip px-1.5 text-2xs font-semibold text-text-subtle tabular-nums">
          {tasks.length}
        </span>
      </h2>

      <ul className="divide-y divide-border">
        {tasks.map((task) => (
          <MyTaskRow key={task.id} task={task} today={today} />
        ))}
      </ul>
    </section>
  );
}
