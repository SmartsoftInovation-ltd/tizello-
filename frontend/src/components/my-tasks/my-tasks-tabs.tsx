import Link from "next/link";
import { TasksIcon } from "@/components/ui/app-icons";
import { CheckIcon, ChecklistIcon, type IconProps } from "@/components/ui/icons";
import { LinkPendingLoader } from "@/components/ui/link-pending-loader";
import { cn } from "@/lib/cn";
import { ASSIGNED_STATES, ASSIGNED_STATE_LABEL, type AssignedState } from "@/types/task";

/*
 * To do / Done / Everything as a segmented control: an icon, the label and
 * that tab's count, so the reader knows what is behind a tab before opening
 * it. Still LINKS (`?state=`), so a choice survives a reload; the pending
 * loader covers the server round trip a tab change is.
 */
const ICON: Record<AssignedState, (props: IconProps) => React.ReactNode> = {
  open: TasksIcon,
  done: CheckIcon,
  all: ChecklistIcon,
};

const ACTIVE = "bg-surface text-text shadow-card";
const IDLE = "text-text-muted hover:text-text";

export function MyTasksTabs({ state, counts }: { state: AssignedState; counts: Record<AssignedState, number> }) {
  return (
    <nav aria-label="Which tasks" className="inline-flex rounded-lg border border-border bg-surface-sunken p-1">
      {ASSIGNED_STATES.map((option) => {
        const Glyph = ICON[option];
        const current = option === state;

        return (
          <Link
            key={option}
            href={option === "open" ? "/my-tasks" : `/my-tasks?state=${option}`}
            aria-current={current ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-100 ease-standard",
              current ? ACTIVE : IDLE,
            )}
          >
            <Glyph className={cn("size-3.5", current && "text-text-brand")} />
            {ASSIGNED_STATE_LABEL[option]}
            <span
              className={cn(
                "rounded-full px-1.5 text-2xs tabular-nums",
                current ? "bg-brand-subtle text-text-brand" : "bg-chip text-text-subtle",
              )}
            >
              {counts[option]}
            </span>
            <LinkPendingLoader label={`Loading ${ASSIGNED_STATE_LABEL[option].toLowerCase()}`} />
          </Link>
        );
      })}
    </nav>
  );
}
