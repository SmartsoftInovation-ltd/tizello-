"use client";

import { useSyncExternalStore } from "react";
import { SprintDrawerForm } from "@/components/sprint-planning/sprint-drawer-form";
import type { TaskScope } from "@/components/tasks/task-draft";
import { Drawer } from "@/components/ui/drawer";
import { getPlanningSurfaceServerSnapshot, readPlanningSurface, subscribeToSurface } from "@/lib/project-surface";
import type { PointsByGroup } from "@/lib/sprint-plan";
import type { ProjectSprint } from "@/types/project-sprint";

/**
 * A sprint, in the same panel a task opens in — side panel or centred modal,
 * sharing SPRINT PLANNING's preference (`lib/project-surface.ts`), which starts
 * as centred. Switching it here switches the task drawer on this screen too.
 *
 * The shell stays mounted and the form is remounted by `formKey` on every open,
 * the arrangement `task-drawer.tsx` documents: the native `<dialog>` hands focus
 * back to whatever opened it, and the remount re-seeds the fields.
 */
export function SprintDrawer({
  open,
  sprint,
  formKey,
  count,
  points,
  scope,
  onClose,
}: {
  open: boolean;
  sprint: ProjectSprint | null;
  formKey: number;
  count: number;
  points: PointsByGroup;
  scope: TaskScope;
  onClose: () => void;
}) {
  const surface = useSyncExternalStore(subscribeToSurface, readPlanningSurface, getPlanningSurfaceServerSnapshot);

  return (
    <Drawer open={open} surface={surface} onOpenChange={(next) => !next && onClose()} aria-label={sprint ? sprint.name : "New sprint"}>
      <SprintDrawerForm
        key={formKey}
        sprint={sprint}
        count={count}
        points={points}
        scope={scope}
        surface={surface}
        onClose={onClose}
      />
    </Drawer>
  );
}
