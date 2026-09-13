"use client";

import { ProjectGlyph } from "@/components/projects/project-glyph";
import { Icon, type IconProps } from "@/components/ui/icons";

/**
 * The glyph and the title — the top of a Notion page, which is what the task
 * panel is modelled on.
 *
 * The glyph is the task's own icon on its own colour, drawn by the same
 * `ProjectGlyph` a project uses, so a task and its project read as the same
 * kind of object. With neither chosen it falls back to the page mark, which is
 * what an untouched Notion page shows.
 *
 * A bare input rather than a labelled `TextField`: the title is the one thing a
 * task must have, and a 12px label would bury it among the properties below.
 * Uncontrolled and seeded by `defaultValue`, because the form is remounted on
 * every open.
 */
export function TaskTitleField({
  icon,
  color,
  defaultValue,
  error,
  autoFocus = false,
  onChange,
}: {
  icon: string;
  color: string;
  defaultValue: string;
  error?: string;
  autoFocus?: boolean;
  onChange: (title: string) => void;
}) {
  return (
    <div>
      {icon || color ? (
        <ProjectGlyph icon={icon} color={color} className="size-11 rounded-md text-2xl" label="Task icon" />
      ) : (
        <TaskPageIcon className="size-11 text-text-subtle" />
      )}

      <input
        name="title"
        autoComplete="off"
        autoFocus={autoFocus}
        defaultValue={defaultValue}
        maxLength={200}
        placeholder="Untitled task"
        aria-label="Task title"
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full rounded-sm border-0 bg-transparent p-0 text-2xl leading-tight font-bold tracking-tight text-text placeholder:text-text-subtle/60 focus-visible:outline-none"
      />
      {error && (
        <p role="alert" className="mt-1 text-2xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** A page with a folded corner. Decorative — the title beside it is the name. */
function TaskPageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 2.5h10v7.5l-3.5 3.5H3z" fill="currentColor" fillOpacity="0.2" />
      <path d="M13 10H9.5v3.5" />
    </Icon>
  );
}
