"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
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
import { updateWorkspaceAction } from "@/lib/actions/workspace-actions";
import { WORKSPACE_ERROR_COPY, type Workspace } from "@/types/workspace";
import { toast } from "sonner";

/**
 * The body of `EditWorkspaceDialog`, split out so the shell can remount it by
 * `key` on every open — that is what re-seeds the two uncontrolled fields from
 * the workspace as it is NOW, rather than as it was when the dialog first
 * mounted.
 *
 * Only changed fields are sent. `PATCH` with the whole row would work, but it
 * would also make every save a write to `updatedAt` for a dialog someone opened
 * and closed, and it would clobber a field a teammate changed in between.
 */
export function EditWorkspaceForm({
  workspace,
  onClose,
}: {
  workspace: Workspace;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description ?? "");
  const [icon, setIcon] = useState(workspace.icon ?? "");
  const [imageUrl, setImageUrl] = useState(workspace.imageUrl ?? "");
  const [color, setColor] = useState(workspace.color ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  /* `null` clears a value server-side, so an emptied field has to survive as
     `null` rather than being dropped as falsy — `updateWorkspaceAction` does
     that conversion; this only decides what CHANGED. */
  function patch() {
    const trimmed = name.trim();
    const nextDescription = description.trim();

    return {
      ...(trimmed !== workspace.name ? { name: trimmed } : {}),
      ...(nextDescription !== (workspace.description ?? "")
        ? { description: nextDescription }
        : {}),
      ...(icon !== (workspace.icon ?? "") ? { icon } : {}),
      ...(imageUrl !== (workspace.imageUrl ?? "") ? { imageUrl } : {}),
      ...(color !== (workspace.color ?? "") ? { color } : {}),
    };
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setErrors({ name: "Give your workspace a name." });
      return;
    }

    const changes = patch();
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    startTransition(async () => {
      const result = await updateWorkspaceAction(workspace.id, changes);

      if (result.fieldErrors) {
        setErrors(result.fieldErrors);
        return;
      }
      if (result.code) {
        toast.error(WORKSPACE_ERROR_COPY[result.code] ?? WORKSPACE_ERROR_COPY.SERVER_ERROR);
        return;
      }

      toast.success("Workspace updated.");
      onClose();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit workspace</DialogTitle>
          <DialogDescription>
            Its web address never changes — {workspace.slug} stays the same
            however the name is edited.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex items-center gap-3">
          <WorkspaceAvatar
            name={name || workspace.name}
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
              autoComplete="off"
              defaultValue={workspace.name}
              error={errors.name}
              validate={(value) => (value.trim() ? null : "Give your workspace a name.")}
              onValueChange={(value) => {
                setName(value);
                setErrors({});
              }}
            />
          </div>
        </div>

        <div className="mt-4">
          <TextArea
            label="Description"
            name="description"
            defaultValue={workspace.description ?? ""}
            placeholder="What is this workspace for?"
            helper="Optional. Shown on the workspace card and its detail page."
            maxLength={500}
            error={errors.description}
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
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </form>
  );
}
