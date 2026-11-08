import Link from "next/link";
import { TasksIcon } from "@/components/ui/app-icons";
import { buttonVariants } from "@/components/ui/button";
import { CheckIcon, ChecklistIcon, type IconProps } from "@/components/ui/icons";
import { BacklogIcon, SprintIcon } from "@/components/ui/nav-icons";
import type { AssignedState } from "@/types/task";

/**
 * Three empties, because they mean three different things: nothing open (all
 * clear — a good state), nothing finished yet, and nothing assigned at all.
 * Same shape as the trash's empty state: a tinted mark, a sentence, and a way
 * to the board where work comes from.
 */
const COPY: Record<
  AssignedState,
  { Glyph: (props: IconProps) => React.ReactNode; title: string; text: string }
> = {
  open: {
    Glyph: CheckIcon,
    title: "You're all caught up",
    text: "Nothing open is assigned to you. New work assigned to you lands here.",
  },
  done: {
    Glyph: TasksIcon,
    title: "Nothing finished yet",
    text: "Tasks you complete show up here, so you can see what you've shipped.",
  },
  all: {
    Glyph: ChecklistIcon,
    title: "Nothing assigned to you",
    text: "When someone puts you on a task in any project you can see, it shows up here.",
  },
};

export function MyTasksEmpty({ state }: { state: AssignedState }) {
  const { Glyph, title, text } = COPY[state];

  return (
    <section className="mt-6 flex flex-col items-center rounded-xl border border-border bg-surface px-4 py-14 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-brand-subtle ring-8 ring-brand-subtle/40">
        <Glyph className="size-7 text-text-brand" />
      </span>
      <h2 className="mt-5 text-base font-semibold text-text">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-text-muted">{text}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link href="/board/sprint" className={buttonVariants({ className: "gap-1.5" })}>
          <SprintIcon className="size-3.5" />
          Open sprint board
        </Link>
        <Link href="/board/backlog" className={buttonVariants({ variant: "outline", className: "gap-1.5" })}>
          <BacklogIcon className="size-3.5" />
          Browse backlog
        </Link>
      </div>
    </section>
  );
}
