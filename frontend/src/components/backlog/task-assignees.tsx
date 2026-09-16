import { TaskAssignee } from "@/components/backlog/task-assignee";
import type { ProjectPerson } from "@/types/project";

/*
 * Everyone on a task, as overlapping discs — the row's end, where one disc used
 * to sit.
 *
 * Three discs at most, then "+N": a row is 40px of height and a dozen avatars
 * would push the title into a wrap. The `ring-surface` cut-out is what keeps
 * two same-hued neighbours readable as two people. Nobody assigned falls
 * through to `TaskAssignee`'s dashed ring, so the column keeps its rhythm.
 */
const SHOWN = 3;

export function TaskAssignees({ people }: { people: ProjectPerson[] }) {
  if (people.length === 0) return <TaskAssignee />;

  const extra = people.length - SHOWN;

  return (
    <span className="flex shrink-0 items-center -space-x-1.5" title={people.map((person) => person.name).join(", ")}>
      {people.slice(0, SHOWN).map((person) => (
        <span key={person.id} className="rounded-full ring-2 ring-surface">
          <TaskAssignee assignee={person} />
        </span>
      ))}
      {extra > 0 && (
        <span className="grid size-6 place-items-center rounded-full bg-surface-hover text-2xs font-semibold text-text-muted ring-2 ring-surface tabular-nums">
          +{extra}
        </span>
      )}
    </span>
  );
}
