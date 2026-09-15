"use client";

import { useId, useState } from "react";
import { ProjectGlyph } from "@/components/projects/project-glyph";
import type { PickerGroup } from "@/components/tasks/backlog-project-picker";
import { Dialog } from "@/components/ui/dialog";
import { CheckIcon, CloseIcon } from "@/components/ui/icons";
import { SearchIcon } from "@/components/ui/nav-icons";
import { WorkspaceAvatar } from "@/components/workspace/workspace-avatar";
import { cn } from "@/lib/cn";

/**
 * Choosing a project, as a modal — the same compact card as the Statuses
 * editor: a titled header with a close button, then the content.
 *
 * A MODAL, NOT A DROPDOWN. People in this app have a dozen-plus projects across
 * workspaces; a dropdown hanging off a toolbar button made that a narrow,
 * clipped list with a scrollbar squeezed down its edge. A centred card gives
 * the list room, and a search box on top makes a long list a typed key away —
 * people type `TSP`, not "Tizaraa Seller Panel". Enter opens the first match.
 *
 * SCROLLS WITHOUT A VISIBLE SCROLLBAR (`scrollbar-hidden`): the wheel, touch and
 * keyboard all still scroll it, and the list's cut-off last row is the cue that
 * there is more. Grouped by workspace, because two workspaces may both have a
 * "Website" and the key alone does not say whose.
 */
const KEY_CHIP = "shrink-0 rounded-xs bg-surface-sunken px-1 py-px font-mono text-2xs font-medium text-text-subtle";

export function ProjectPickerDialog({
  open,
  groups,
  selectedId,
  onChoose,
  onOpenChange,
}: {
  open: boolean;
  groups: PickerGroup[];
  selectedId?: string;
  onChoose: (projectId: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const titleId = useId();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = groups
    .map((group) => ({
      ...group,
      projects: group.projects.filter(
        (project) => !needle || project.name.toLowerCase().includes(needle) || project.key.toLowerCase().includes(needle),
      ),
    }))
    .filter((group) => group.projects.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} aria-labelledby={titleId} className="max-w-sm">
      <div className="p-3">
        <div className="flex items-center gap-2 border-b border-border px-1 pb-2.5">
          <h2 id={titleId} className="min-w-0 flex-1 truncate text-sm font-semibold text-text">
            Projects
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

        <label className="mt-2.5 flex h-8 items-center gap-1.5 rounded-sm border border-border bg-surface px-2 focus-within:border-border-strong">
          <SearchIcon className="size-3.5 shrink-0 text-text-subtle" />
          <span className="sr-only">Search projects by name or key</span>
          <input
            type="search"
            data-autofocus
            value={query}
            autoComplete="off"
            placeholder="Search by name or key"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              const first = shown[0]?.projects[0];
              if (event.key === "Enter" && first) onChoose(first.id);
            }}
            className="min-w-0 flex-1 appearance-none bg-transparent text-xs text-text outline-none placeholder:text-text-subtle [&::-webkit-search-cancel-button]:hidden"
          />
        </label>

        <div className="scrollbar-hidden mt-2 max-h-[min(26rem,60dvh)] overflow-y-auto">
          {shown.length === 0 && <p className="px-2 py-6 text-center text-xs text-text-subtle">No projects match.</p>}

          {shown.map(({ workspace, projects }) => (
            <section key={workspace.id} aria-label={workspace.name} className="pt-1.5">
              <div className="flex items-center gap-2 px-2 pb-1">
                <WorkspaceAvatar name={workspace.name} icon={workspace.icon} color={workspace.color} accent={workspace.accent} size="sm" />
                <span className="min-w-0 truncate text-2xs font-semibold tracking-widest text-text-subtle uppercase">{workspace.name}</span>
              </div>

              <ul>
                {projects.map((project) => {
                  const current = project.id === selectedId;
                  return (
                    <li key={project.id}>
                      <button
                        type="button"
                        aria-current={current ? "page" : undefined}
                        onClick={() => onChoose(project.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors duration-100 ease-standard hover:bg-surface-hover",
                          current ? "bg-surface-hover text-text" : "text-text-muted hover:text-text",
                        )}
                      >
                        <ProjectGlyph icon={project.icon} color={project.color} />
                        <span className="min-w-0 flex-1 truncate">{project.name}</span>
                        <span className={KEY_CHIP}>{project.key}</span>
                        {current ? (
                          <CheckIcon className="size-3.5 shrink-0 text-text-brand" />
                        ) : (
                          <span className="size-3.5 shrink-0" aria-hidden="true" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
