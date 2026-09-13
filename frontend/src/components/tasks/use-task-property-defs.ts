"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { TaskScope } from "@/components/tasks/task-draft";
import {
  createTaskPropertyDefAction,
  deleteTaskPropertyDefAction,
} from "@/lib/actions/task-property-actions";
import type { PropertyType } from "@/types/project-property";
import { taskErrorCopy, type TaskPropertyDef } from "@/types/task";

/**
 * The project's task-column SCHEMA as the drawer holds it: a local list seeded
 * from the server, and the two writes that change it.
 *
 * The per-project twin of `use-property-defs.ts`, and it writes immediately for
 * the same reason — a column belongs to every task in the project, not to the
 * one whose drawer happens to be open.
 *
 * A new column is NOT seeded with an empty value, unlike the project version.
 * An empty DATE is `""`, and `""` is not a date: seeding it would put a `422`
 * into the next Save for a field nobody touched. The row renders its own empty
 * state from `undefined` instead.
 */
export function useTaskPropertyDefs(scope: TaskScope) {
  const [defs, setDefs] = useState(scope.definitions);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function create(input: { name: string; type: PropertyType }) {
    startTransition(async () => {
      const result = await createTaskPropertyDefAction(
        scope.workspaceId,
        scope.projectId,
        input,
      );

      if (result.fieldErrors?.name) {
        setError(result.fieldErrors.name);
        return;
      }
      if (result.code || !result.property) {
        setError(taskErrorCopy(result.code ?? "SERVER_ERROR"));
        return;
      }

      const created = result.property;
      setDefs((current) => [...current, created]);
      setError(undefined);
    });
  }

  function remove(definition: TaskPropertyDef) {
    startTransition(async () => {
      const result = await deleteTaskPropertyDefAction(
        scope.workspaceId,
        scope.projectId,
        definition.id,
      );

      if (result.code) {
        toast.error(taskErrorCopy(result.code));
        return;
      }

      setDefs((current) => current.filter((entry) => entry.id !== definition.id));
      toast.success(`${definition.name} removed from every task in ${scope.projectName}.`);
    });
  }

  return { defs, error, isPending, create, remove };
}
