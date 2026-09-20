import { TrashRowActions } from "@/components/trash/trash-row-actions";
import { TaskTypeIcon } from "@/components/tasks/task-type-icon";
import { formatDeadline } from "@/lib/format-date";
import type { Trash, TrashEntry } from "@/types/trash";
import type { TaskType } from "@/types/task";

/**
 * The trash: deleted projects and deleted tasks, newest first, each with a way
 * back.
 *
 * TWO SECTIONS, NOT ONE MERGED LIST. A deleted project and a deleted task are
 * different sizes of mistake — restoring the first brings a whole team's work
 * back, restoring the second brings one row — and interleaving them by date
 * would put those two decisions side by side looking identical.
 *
 * A Server Component; only the per-row buttons are a client leaf.
 */
export function TrashPanel({ trash }: { trash: Trash }) {
  const total = trash.projects.length + trash.tasks.length;

  if (total === 0) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-border bg-panel px-4 py-12 text-center">
        <p className="text-sm font-semibold text-text">The trash is empty</p>
        <p className="mt-1 text-xs text-text-muted">Deleted projects and tasks land here, and can be put back.</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <Section title="Projects" entries={trash.projects} />
      <Section title="Tasks" entries={trash.tasks} />
    </div>
  );
}

function Section({ title, entries }: { title: string; entries: TrashEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <section className="mt-6 first:mt-0">
      <h2 className="flex items-baseline gap-2 border-b border-border px-2 pb-1.5">
        <span className="text-2xs font-semibold tracking-widest text-text-subtle uppercase">{title}</span>
        <span className="text-2xs text-text-subtle tabular-nums">{entries.length}</span>
      </h2>

      <ul>
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-3 border-b border-border px-2 py-2.5 last:border-b-0">
            <span className="shrink-0">
              {entry.kind === "task" ? (
                <TaskTypeIcon type={entry.type as TaskType} />
              ) : (
                <span aria-hidden="true" className="grid size-4 place-items-center text-sm">
                  {entry.icon ?? "📁"}
                </span>
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-text">{entry.name}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-2xs text-text-subtle">
                <span className="font-mono">{entry.key}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{entry.kind === "task" ? entry.projectName : (entry.workspaceName ?? "")}</span>
              </span>
            </span>

            {/* Deleted WHEN matters more than deleted by whom: the reader is
                looking for the thing they lost this morning. */}
            <span className="hidden w-28 shrink-0 text-right text-xs text-text-muted tabular-nums sm:block">
              {formatDeadline(entry.deletedAt)}
            </span>

            <TrashRowActions entry={entry} />
          </li>
        ))}
      </ul>
    </section>
  );
}
