import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/initials";
import type { ProjectPerson } from "@/types/project";

/*
 * The assignee disc on a row. Initials only, the same bargain `PersonCell`
 * makes: `ProjectPerson` carries no `avatarUrl`, nothing in this app has an
 * image source, and inventing one would mean shipping a placeholder photo of
 * a person who does not exist.
 *
 * Unassigned renders a dashed ring rather than nothing, so the column keeps its
 * rhythm and "nobody has picked this up" is visible at a glance.
 */
/* "sm" is the chip-sized disc in the filter dialog. Full strings, so Tailwind sees them. */
const DISC = { md: "size-6 text-2xs", sm: "size-4 text-[0.5rem]" } as const;

/*
 * Each person gets one of the label hues, picked from their id so the same
 * person is the same colour on every row and every page. Solid fill with
 * ink-900 initials: the label hues are too light to carry text on white, but
 * dark text on them reads in both themes. Literal strings so Tailwind sees them.
 */
const TONES = [
  "bg-label-blue",
  "bg-label-green",
  "bg-label-orange",
  "bg-label-purple",
  "bg-label-pink",
  "bg-label-yellow",
  "bg-label-red",
  "bg-label-brown",
];

function toneFor(id: string) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return TONES[Math.abs(hash) % TONES.length];
}

export function TaskAssignee({ assignee, size = "md" }: { assignee?: ProjectPerson; size?: keyof typeof DISC }) {
  if (!assignee) {
    return (
      <span
        title="Unassigned"
        className="flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border-strong"
      >
        <span className="sr-only">Unassigned</span>
        <span aria-hidden="true" className="text-2xs text-text-subtle">
          &mdash;
        </span>
      </span>
    );
  }

  return (
    <Avatar className={cn(DISC[size], toneFor(assignee.id))} title={assignee.name}>
      <AvatarFallback className="text-ink-900">
        <span aria-hidden="true">{initials(assignee.name)}</span>
        <span className="sr-only">Assigned to {assignee.name}</span>
      </AvatarFallback>
    </Avatar>
  );
}
