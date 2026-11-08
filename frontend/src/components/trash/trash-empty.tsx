import Link from "next/link";
import { TasksIcon } from "@/components/ui/app-icons";
import { buttonVariants } from "@/components/ui/button";
import { Icon, TrashIcon, type IconProps } from "@/components/ui/icons";
import { ProjectsIcon } from "@/components/ui/nav-icons";

/**
 * The trash with nothing in it. Not an error and not a dead end: a brand-tinted
 * mark says "all clear", three short facts say what this page is for, and one
 * link leads back to work.
 *
 * A Server Component — nothing here is interactive beyond a link.
 */

/** A counter-clockwise arrow: "put back". Local because only this page draws it. */
function RestoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 8a5 5 0 105-5H5.5" />
      <path d="M6.5 1.5L5 3l1.5 1.5" />
    </Icon>
  );
}

const FACTS = [
  { Glyph: ProjectsIcon, title: "Deleted projects", text: "Come back with all their tasks." },
  { Glyph: TasksIcon, title: "Deleted tasks", text: "Return to the board they left." },
  { Glyph: RestoreIcon, title: "Restore anytime", text: "One click puts anything back." },
] as const;

export function TrashEmpty() {
  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-col items-center px-4 pt-12 pb-8 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-brand-subtle ring-8 ring-brand-subtle/40">
          <TrashIcon className="size-7 text-text-brand" />
        </span>
        <h2 className="mt-5 text-base font-semibold text-text">Your trash is empty</h2>
        <p className="mt-1 max-w-sm text-sm text-text-muted">
          Nothing has been deleted. When a project or task is removed, it waits here so you can bring it back.
        </p>
        <Link href="/workspaces" className={buttonVariants({ className: "mt-5" })}>
          Back to workspaces
        </Link>
      </div>

      <ul className="grid border-t border-border bg-surface-sunken sm:grid-cols-3">
        {FACTS.map(({ Glyph, title, text }) => (
          <li
            key={title}
            className="flex items-start gap-3 border-b border-border px-5 py-4 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-subtle text-text-brand">
              <Glyph className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-text">{title}</span>
              <span className="mt-0.5 block text-xs text-text-subtle">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
