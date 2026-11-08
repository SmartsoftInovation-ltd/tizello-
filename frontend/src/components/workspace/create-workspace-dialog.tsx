"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";
import { WorkspaceAppearancePicker } from "@/components/workspace/workspace-appearance-picker";
import { WorkspaceAvatar } from "@/components/workspace/workspace-avatar";
import { createWorkspaceAction } from "@/lib/actions/workspace-actions";
import { WORKSPACE_ERROR_COPY } from "@/types/workspace";
import { toast } from "sonner";

/**
 * The workspace creation modal. Unlike `CreateEntityDialog` (a bare name
 * field shared with "New project"), this one is wired to the real API and
 * lets the icon/color the backend now stores be set at creation rather than
 * left to a later edit — a live preview is the whole reason to offer that
 * here instead of behind a second trip to settings.
 *
 * `createWorkspaceAction` is called directly from the submit handler inside
 * `startTransition`, not through `useActionState` — the result is branched on
 * right there, synchronously, so closing the dialog on success never needs an
 * effect watching for it (see the comment on the action itself).
 */
export function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const titleId = useId();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [color, setColor] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();

  function reset() {
    setName("");
    setDescription("");
    setIcon("");
    setImageUrl("");
    setColor("");
    setNameError(undefined);
  }

  function close() {
    reset();
    onOpenChange(false);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Give your workspace a name.");
      return;
    }

    startTransition(async () => {
      const result = await createWorkspaceAction({
        name: trimmed,
        description: description.trim() || undefined,
        icon: icon || undefined,
        imageUrl: imageUrl || undefined,
        color: color || undefined,
      });

      if (result.fieldErrors) {
        setNameError(result.fieldErrors.name);
        return;
      }
      if (result.code) {
        toast.error(WORKSPACE_ERROR_COPY[result.code] ?? WORKSPACE_ERROR_COPY.SERVER_ERROR);
        return;
      }

      toast.success(`${trimmed} is ready.`);
      close();
    });
  }

  return (
    <Dialog open={open} onOpenChange={close} aria-labelledby={titleId}>
      <form onSubmit={onSubmit} noValidate>
        <DialogContent>
          <DialogHeader>
            <DialogTitle id={titleId}>Create workspace</DialogTitle>
            <DialogDescription>
              Workspaces hold your projects and the people working on them. You
              can rename it later.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex items-center gap-3">
            <WorkspaceAvatar
              name={name || "New workspace"}
              icon={icon}
              imageUrl={imageUrl || null}
              color={color || null}
              size="lg"
              label="Preview"
            />
            <div className="min-w-0 flex-1">
              <TextField
                label="Workspace name"
                name="name"
                placeholder="e.g. Northwind Studio"
                autoComplete="off"
                autoFocus
                error={nameError}
                validate={(value) => (value.trim() ? null : "Give your workspace a name.")}
                onValueChange={(value) => {
                  setName(value);
                  setNameError(undefined);
                }}
              />
            </div>
          </div>

          <div className="mt-4">
            <TextArea
              label="Description"
              name="description"
              placeholder="What is this workspace for?"
              helper="Optional. Shown on the workspace card and its detail page."
              maxLength={500}
              onValueChange={setDescription}
            />
          </div>

          <WorkspaceAppearancePicker
            icon={icon}
            imageUrl={imageUrl}
            color={color}
            onIconChange={setIcon}
            onImageChange={setImageUrl}
            onColorChange={setColor}
          />

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </form>
    </Dialog>
  );
}
