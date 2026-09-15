"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DrawerCloseButton } from "@/components/projects/drawer-title";
import { SurfaceMenu } from "@/components/projects/surface-menu";
import { datesError, SprintDetailsFields } from "@/components/sprint-planning/sprint-details-fields";
import { SprintDurationChoices } from "@/components/sprint-planning/sprint-duration-choices";
import { SprintSummary } from "@/components/sprint-planning/sprint-summary";
import type { TaskScope } from "@/components/tasks/task-draft";
import { Button } from "@/components/ui/button";
import { DrawerBody, DrawerFooter, DrawerForm, DrawerHeader } from "@/components/ui/drawer";
import { TextField } from "@/components/ui/text-field";
import { createSprintAction, updateSprintAction } from "@/lib/actions/sprint-actions";
import type { ProjectSurface } from "@/lib/project-surface";
import type { PointsByGroup } from "@/lib/sprint-plan";
import { sprintErrorCopy, type ProjectSprint } from "@/types/project-sprint";

/**
 * The body of the sprint drawer: name, length and dates, goal, capacity — and,
 * for a sprint that exists, a summary of what is already in it.
 *
 * The same anatomy as the task drawer (header with the surface switch, a large
 * title, fields, a Save footer), so a sprint opens the way a task does. Every
 * field is optional on create: a blank name becomes "<KEY> Sprint <n>", and dates
 * can wait until the sprint is started. Remounted per open by `key`, so it seeds
 * from the sprint without an effect; closes only once the API has answered.
 */
export function SprintDrawerForm({
  sprint,
  count,
  points,
  scope,
  surface,
  onClose,
}: {
  /** `null` creates. */
  sprint: ProjectSprint | null;
  count: number;
  points: PointsByGroup;
  scope: TaskScope;
  surface: ProjectSurface;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(sprint?.name ?? "");
  const [goal, setGoal] = useState(sprint?.goal ?? "");
  const [dates, setDates] = useState({ startDate: sprint?.startDate ?? "", endDate: sprint?.endDate ?? "" });
  const [capacity, setCapacity] = useState(sprint?.capacityPoints == null ? "" : String(sprint.capacityPoints));
  const readOnly = !scope.canManageProperties || sprint?.state === "COMPLETED";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly || datesError(dates)) return;

    const input = {
      ...(name.trim() ? { name: name.trim() } : {}),
      goal: goal.trim() || null,
      startDate: dates.startDate || null,
      endDate: dates.endDate || null,
      capacityPoints: capacity ? Number(capacity) : null,
    };

    startTransition(async () => {
      const result = sprint
        ? await updateSprintAction(scope.workspaceId, scope.projectId, sprint.id, input)
        : await createSprintAction(scope.workspaceId, scope.projectId, input);
      if (result.code) return void toast.error(sprintErrorCopy(result.code));
      toast.success(result.message);
      onClose();
    });
  }

  return (
    <DrawerForm onSubmit={submit} noValidate>
      <DrawerHeader>
        <p className="min-w-0 flex-1 truncate text-xs text-text-subtle">
          {sprint ? <span className="font-mono">{sprint.key}</span> : `New sprint in ${scope.projectName}`}
        </p>
        <SurfaceMenu surface={surface} scope="planning" />
        <DrawerCloseButton onClose={onClose} />
      </DrawerHeader>

      <DrawerBody className="px-6 py-6">
        <input
          name="name"
          autoComplete="off"
          autoFocus={!sprint}
          data-autofocus={!sprint || undefined}
          maxLength={80}
          disabled={readOnly}
          defaultValue={name}
          placeholder="Sprint name (blank uses the next number)"
          aria-label="Sprint name"
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-sm border-0 bg-transparent p-0 text-2xl leading-tight font-bold tracking-tight text-text placeholder:text-base placeholder:font-normal placeholder:text-text-subtle/70 focus-visible:outline-none"
        />

        {sprint && <SprintSummary sprint={sprint} count={count} points={points} today={scope.today} />}

        <fieldset disabled={readOnly} className="mt-6 space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-text-muted">Length</p>
            <SprintDurationChoices {...dates} fallbackStart={scope.today} onChange={setDates} />
          </div>
          <SprintDetailsFields dates={dates} goal={goal} today={scope.today} onDates={setDates} onGoal={setGoal} />
          <TextField
            label="Capacity (story points)"
            name="capacity"
            autoComplete="off"
            required={false}
            placeholder="Not decided"
            helper="What the team expects to finish. The sprint header measures the plan against it."
            value={capacity}
            transform={(value) => value.replace(/\D/g, "").slice(0, 4)}
            onValueChange={setCapacity}
          />
        </fieldset>
      </DrawerBody>

      <DrawerFooter>
        {readOnly && (
          <p className="mr-auto text-2xs text-text-subtle">
            {sprint?.state === "COMPLETED" ? "A completed sprint is a record and can't be edited." : "Only the project's owner or a manager can change sprints."}
          </p>
        )}
        <Button type="button" variant="outline" onClick={onClose}>
          {readOnly ? "Close" : "Cancel"}
        </Button>
        {!readOnly && (
          <Button type="submit" disabled={isPending || Boolean(datesError(dates))}>
            {isPending ? "Saving…" : sprint ? "Save changes" : "Create sprint"}
          </Button>
        )}
      </DrawerFooter>
    </DrawerForm>
  );
}
