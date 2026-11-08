"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { AppImage } from "@/components/ui/app-image";
import { Icon, type IconProps } from "@/components/ui/icons";
import { uploadFileAction } from "@/lib/actions/upload-actions";
import { avatarSrc } from "@/lib/profile-display";
import { formatBytes, MAX_UPLOAD_BYTES } from "@/lib/upload-limits";

/*
 * The workspace's picture: upload one, replace it, or remove it. The file goes
 * to `POST /uploads` straight away and the returned path becomes form state;
 * the workspace row only changes when the form is saved — the same two-step
 * the profile photo uses (`profile-avatar.tsx`), so a cancelled dialog leaves
 * the workspace as it was.
 *
 * A picture wins over the emoji icon wherever the workspace is drawn
 * (`WorkspaceAvatar`); removing it falls back to the icon, then to initials.
 * Size and type are checked here first, because an oversized body makes the
 * Server Action throw rather than return — see `lib/upload-limits.ts`.
 */
function UploadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 10.5V3M5 6l3-3 3 3" />
      <path d="M2.5 10.5v2a1 1 0 001 1h9a1 1 0 001-1v-2" />
    </Icon>
  );
}

const BUTTON =
  "inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-text transition-colors duration-100 ease-standard hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-60";

export function WorkspaceImageField({
  imageUrl,
  onChange,
}: {
  imageUrl: string;
  onChange: (imageUrl: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const src = avatarSrc(imageUrl || null);

  function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file (PNG, JPG, WebP or GIF).");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`${formatBytes(file.size)} is too big — images must be ${formatBytes(MAX_UPLOAD_BYTES)} or smaller.`);
      return;
    }

    startTransition(async () => {
      const body = new FormData();
      body.append("file", file);
      const uploaded = await uploadFileAction(body);

      if (!uploaded.ok) {
        toast.error(uploaded.message);
        return;
      }
      onChange(uploaded.file.url);
    });
  }

  return (
    <fieldset className="mt-5">
      <legend className="text-xs font-semibold text-text-muted">Image</legend>
      <div className="mt-2 flex items-center gap-3">
        <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-border-strong bg-surface-sunken text-text-subtle">
          {src ? (
            <AppImage src={src} alt="Workspace image" fill unoptimized sizes="48px" className="object-cover" />
          ) : (
            <UploadIcon className="size-5" />
          )}
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BUTTON} disabled={pending} onClick={() => inputRef.current?.click()}>
              <UploadIcon className="size-3.5" />
              {pending ? "Uploading…" : src ? "Replace image" : "Upload image"}
            </button>
            {src && (
              <button type="button" className={BUTTON} disabled={pending} onClick={() => onChange("")}>
                Remove
              </button>
            )}
          </div>
          <p className="mt-1 text-2xs text-text-subtle">
            Shown instead of the icon. PNG, JPG, WebP or GIF, up to {formatBytes(MAX_UPLOAD_BYTES)}.
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) upload(file);
          }}
        />
      </div>
    </fieldset>
  );
}
