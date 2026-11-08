import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Icon, type IconProps } from "@/components/ui/icons";
import { HomeIcon } from "@/components/ui/nav-icons";
import { workspacesHref } from "@/lib/workspace-view";
import type { WorkspaceView } from "@/types/workspace";

/**
 * "Nothing archived" — shared by the grid and the list, so both views of
 * `?archived=1` say the same thing. Same shape as the trash's empty state
 * (`trash/trash-empty.tsx`): a brand-tinted mark, a sentence, a way back, and
 * three short facts about what archiving does.
 *
 * Drawn INSTEAD of the list's table: a header row over a single sentence read
 * as a broken table, which is what this replaced.
 */
function ArchiveIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2" y="3" width="12" height="3" rx="1" />
      <path d="M3 6v6.5a1 1 0 001 1h8a1 1 0 001-1V6M6.5 9h3" />
    </Icon>
  );
}

function EyeOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4z" />
      <path d="M2.5 2.5l11 11" />
    </Icon>
  );
}

function RestoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 8a5 5 0 105-5H5.5" />
      <path d="M6.5 1.5L5 3l1.5 1.5" />
    </Icon>
  );
}

const FACTS = [
  { Glyph: ArchiveIcon, title: "Nothing is deleted", text: "Projects, tasks and members stay as they are." },
  { Glyph: EyeOffIcon, title: "Out of the way", text: "Archived workspaces leave your main list." },
  { Glyph: RestoreIcon, title: "Restore anytime", text: "Unarchive from the workspace's menu." },
] as const;

export function ArchivedEmpty({ view }: { view: WorkspaceView }) {
  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-col items-center px-4 pt-12 pb-8 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-brand-subtle ring-8 ring-brand-subtle/40">
          <ArchiveIcon className="size-7 text-text-brand" />
        </span>
        <h2 className="mt-5 text-base font-semibold text-text">No archived workspaces</h2>
        <p className="mt-1 max-w-sm text-sm text-text-muted">
          When you archive a workspace it moves here, out of your list but with everything kept.
        </p>
        <Link href={workspacesHref({ view, archived: false })} className={buttonVariants({ className: "mt-5 gap-1.5" })}>
          <HomeIcon className="size-3.5" />
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
