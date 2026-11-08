import { STATUS_DOT } from "@/components/tasks/task-tone";
import { cn } from "@/lib/cn";
import type { StatusShare } from "@/lib/sprint-breakdown";

/**
 * The status share as COLUMNS, drawn beside the donut: one bar per status in
 * board order, its height the status's card count against the fullest one,
 * the count above it and the name below.
 *
 * The donut answers "what fraction"; bars answer "which column is biggest"
 * at a glance, which a ring of similar arcs does badly. Same data, same
 * colours (`STATUS_DOT`), so the two read as one figure.
 *
 * A Server Component with no JavaScript. Bar heights are genuinely dynamic,
 * so they are the one `style`. The legend beside it carries every value as
 * text, so this figure is labelled once rather than read bar by bar.
 */
export function StatusShareBars({ shares, label }: { shares: StatusShare[]; label: string }) {
  const max = Math.max(1, ...shares.map((slice) => slice.count));

  return (
    <figure role="img" aria-label={label} className="w-full min-w-0">
      <div className="flex h-44 items-end gap-2 border-b border-border px-1">
        {shares.map((slice) => (
          <div key={slice.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-xs font-semibold text-text tabular-nums">{slice.count}</span>
            <span
              title={`${slice.name}: ${slice.count} ${slice.count === 1 ? "task" : "tasks"} · ${slice.points} pts`}
              className={cn(
                "w-full max-w-10 rounded-t-sm transition-[height] duration-500 ease-standard",
                slice.count > 0 ? STATUS_DOT[slice.color] : "bg-surface-hover",
              )}
              style={{ height: slice.count > 0 ? `${(slice.count / max) * 100}%` : "2px" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2 px-1">
        {shares.map((slice) => (
          <span key={slice.id} title={slice.name} className="min-w-0 flex-1 truncate text-center text-2xs text-text-subtle">
            {slice.name}
          </span>
        ))}
      </div>
    </figure>
  );
}
