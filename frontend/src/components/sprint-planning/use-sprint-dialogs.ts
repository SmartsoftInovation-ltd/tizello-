"use client";

import { useState } from "react";
import type { SprintAction } from "@/components/sprint-planning/sprint-header";
import type { ProjectSprint } from "@/types/project-sprint";

/**
 * Which sprint dialog is open, and for which sprint — one state, so two can
 * never be open at once.
 *
 * `key` increments on every open. The dialogs seed their fields from the sprint
 * at MOUNT, so remounting per open is what makes "Edit" show the sprint as it is
 * now rather than as it was the last time the dialog closed — without an effect
 * syncing props into state.
 */
export type SprintDialog =
  | { kind: "none" }
  | { kind: "form"; sprint: ProjectSprint | null }
  | { kind: "start" | "complete" | "delete"; sprint: ProjectSprint };

export function useSprintDialogs() {
  const [dialog, setDialog] = useState<SprintDialog>({ kind: "none" });
  const [key, setKey] = useState(0);

  function open(next: SprintDialog) {
    setKey((current) => current + 1);
    setDialog(next);
  }

  return {
    dialog,
    key,
    close: () => setDialog({ kind: "none" }),
    create: () => open({ kind: "form", sprint: null }),
    /* "add-task" opens the TASK drawer, which the board owns — not a sprint surface. */
    act: (sprint: ProjectSprint, action: Exclude<SprintAction, "add-task">) =>
      open(action === "edit" ? { kind: "form", sprint } : { kind: action, sprint }),
  };
}
