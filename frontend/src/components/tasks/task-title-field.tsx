"use client";

import { TaskTypeIcon } from "@/components/tasks/task-type-icon";
import type { TaskType } from "@/types/task";

/**
 * The type mark and the title — the top of the task panel.
 *
 * The mark is the task's TYPE (Task / Story / Bug / Epic), the same square the
 * backlog row draws before the key. It replaced a free-choice emoji and colour:
 * a mark that says what kind of work this is carries information, a decorative
 * one did not. Type itself is changed in the Properties list.
 *
 * A bare input rather than a labelled `TextField`: the title is the one thing a
 * task must have, and a 12px label would bury it among the properties below.
 * Uncontrolled and seeded by `defaultValue`, because the form is remounted on
 * every open.
 */
export function TaskTitleField({
  type,
  defaultValue,
  error,
  autoFocus = false,
  onChange,
}: {
  type: TaskType;
  defaultValue: string;
  error?: string;
  autoFocus?: boolean;
  onChange: (title: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <TaskTypeIcon type={type} size="lg" />

        <input
          name="title"
          autoComplete="off"
          autoFocus={autoFocus}
          data-autofocus={autoFocus || undefined}
          defaultValue={defaultValue}
          maxLength={200}
          placeholder="Untitled task"
          aria-label="Task title"
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 rounded-sm border-0 bg-transparent p-0 text-2xl leading-tight font-bold tracking-tight text-text placeholder:text-text-subtle/60 focus-visible:outline-none"
        />
      </div>
      {error && (
        <p role="alert" className="mt-1 text-2xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

