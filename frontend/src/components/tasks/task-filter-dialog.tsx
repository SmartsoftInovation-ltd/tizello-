"use client";

import { useId } from "react";
import { TaskAssignee } from "@/components/backlog/task-assignee";
import { FilterChip } from "@/components/tasks/filter-chip";
import { memberName, type TaskScope } from "@/components/tasks/task-draft";
import { TaskTypeIcon } from "@/components/tasks/task-type-icon";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CloseIcon } from "@/components/ui/icons";
import { NO_FILTERS, type TaskFilters } from "@/lib/task-filters";
import { PROJECT_PRIORITIES, PROJECT_PRIORITY_LABEL } from "@/types/project";
import { TASK_TYPES, TASK_TYPE_LABEL } from "@/types/task";

/**
 * Type, Priority, Assignee and Tag, as a modal — the same compact card as
 * `ProjectPickerDialog`: a titled header with a close button, then the content.
 *
 * A MODAL OF CHIPS, NOT A DROPDOWN LIST. Four groups one row per value made a
 * 440px menu with a scrollbar squeezed down its edge; as wrapping chips the
 * whole set usually fits without scrolling, and what does scroll hides its bar
 * (`scrollbar-hidden`). Choices apply AS THEY ARE CLICKED — the list behind
 * the scrim updates live — so Done only closes. Search stays in the toolbar.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="pt-3">
      <h3 className="px-1 pb-1.5 text-2xs font-semibold tracking-widest text-text-subtle uppercase">{title}</h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
}

export function TaskFilterDialog({
  open,
  filters,
  tags,
  scope,
  active,
  onChange,
  onOpenChange,
}: {
  open: boolean;
  filters: TaskFilters;
  tags: string[];
  scope: TaskScope;
  /** Narrowings on in this dialog — search excluded, it has its own box. */
  active: number;
  onChange: (next: TaskFilters) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const titleId = useId();
  const toggle = <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) =>
    onChange({ ...filters, [key]: filters[key] === value ? "" : value });
  const others = scope.members.filter((member) => member.userId !== scope.currentUserId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} aria-labelledby={titleId} className="max-w-md">
      <div className="p-3">
        <div className="flex items-center gap-2 border-b border-border px-1 pb-2.5">
          <h2 id={titleId} className="min-w-0 flex-1 truncate text-sm font-semibold text-text">
            Filters
            {active > 0 && <span className="ml-1.5 rounded-full bg-brand-100 px-1.5 py-px text-2xs text-brand-800">{active}</span>}
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="grid size-7 place-items-center rounded-sm text-text-subtle transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
          >
            <CloseIcon className="size-3.5" />
          </button>
        </div>

        <div className="scrollbar-hidden max-h-[min(28rem,65dvh)] overflow-y-auto px-1 pb-1">
          <Section title="Type">
            {TASK_TYPES.map((type) => (
              <FilterChip key={type} label={TASK_TYPE_LABEL[type]} selected={filters.type === type} adornment={<TaskTypeIcon type={type} />} onToggle={() => toggle("type", type)} />
            ))}
          </Section>

          <Section title="Priority">
            {PROJECT_PRIORITIES.map((priority) => (
              <FilterChip key={priority} label={PROJECT_PRIORITY_LABEL[priority]} selected={filters.priority === priority} onToggle={() => toggle("priority", priority)} />
            ))}
            <FilterChip label="No priority" selected={filters.priority === "none"} onToggle={() => toggle("priority", "none")} />
          </Section>

          <Section title="Assignee">
            <FilterChip label="Assigned to me" selected={filters.assigneeId === scope.currentUserId} onToggle={() => toggle("assigneeId", scope.currentUserId)} />
            <FilterChip label="Unassigned" selected={filters.assigneeId === "none"} onToggle={() => toggle("assigneeId", "none")} />
            {others.map((member) => (
              <FilterChip
                key={member.userId}
                label={memberName(member)}
                selected={filters.assigneeId === member.userId}
                adornment={<TaskAssignee assignee={{ id: member.userId, name: memberName(member) }} size="sm" />}
                onToggle={() => toggle("assigneeId", member.userId)}
              />
            ))}
          </Section>

          {tags.length > 0 && (
            <Section title="Tag">
              {tags.slice(0, 20).map((tag) => (
                <FilterChip key={tag} label={tag} selected={filters.tag === tag} onToggle={() => toggle("tag", tag)} />
              ))}
            </Section>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border px-1 pt-2.5">
          <Button size="sm" variant="ghost" disabled={active === 0} onClick={() => onChange({ ...NO_FILTERS, q: filters.q })}>
            Clear all
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
