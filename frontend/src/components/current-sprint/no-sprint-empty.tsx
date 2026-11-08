import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PlayIcon } from "@/components/ui/icons";
import { BacklogIcon, PlanningIcon, SprintIcon } from "@/components/ui/nav-icons";

/**
 * "No sprint is running" — shared by the sprint board and the sprint
 * breakdown, which go empty for the same reason and fix it the same way.
 *
 * Shaped like the trash's empty state (`trash/trash-empty.tsx`): a
 * brand-tinted mark, a sentence, one primary action, then the three steps of
 * the workflow (`.claude/rules/workflow.md`) so someone new learns how a board
 * comes to exist, not just that this one does not.
 *
 * No hooks or handlers, so it renders on either side of the client boundary.
 */
const STEPS = [
  { Glyph: BacklogIcon, title: "Fill the backlog", text: "Add the tasks your team needs to do." },
  { Glyph: PlanningIcon, title: "Plan a sprint", text: "Drag tasks into a sprint and press Start." },
  { Glyph: SprintIcon, title: "Work the board", text: "Move cards across columns as work moves." },
] as const;

export function NoSprintEmpty({ planningHref }: { planningHref: string }) {
  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-col items-center px-4 pt-12 pb-8 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-brand-subtle ring-8 ring-brand-subtle/40">
          <SprintIcon className="size-7 text-text-brand" />
        </span>
        <h2 className="mt-5 text-base font-semibold text-text">No sprint is running</h2>
        <p className="mt-1 max-w-sm text-sm text-text-muted">
          Start a sprint from sprint planning and its board shows up here.
        </p>
        <Link href={planningHref} className={buttonVariants({ className: "mt-5 gap-1.5" })}>
          <PlayIcon className="size-3.5" />
          Go to sprint planning
        </Link>
      </div>

      <ol className="grid border-t border-border bg-surface-sunken sm:grid-cols-3">
        {STEPS.map(({ Glyph, title, text }, index) => (
          <li
            key={title}
            className="flex items-start gap-3 border-b border-border px-5 py-4 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-subtle text-text-brand">
              <Glyph className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-text">
                <span className="text-text-brand tabular-nums">{index + 1}.</span> {title}
              </span>
              <span className="mt-0.5 block text-xs text-text-subtle">{text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
