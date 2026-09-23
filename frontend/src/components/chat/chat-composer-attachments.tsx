"use client";

import { AppImage } from "@/components/ui/app-image";
import { isImage, isVideo, uploadUrl } from "@/lib/uploads";
import { formatBytes } from "@/lib/upload-limits";
import type { ChatAttachment } from "@/types/chat";

/*
 * What is waiting to be sent: a row of chips above the pill, each removable.
 *
 * THE FILES ARE ALREADY ON THE SERVER by the time they appear here — picking
 * one uploads it (`chat-attach-button.tsx`). Removing a chip therefore only
 * drops it from THIS message; the bytes stay in the upload directory, orphaned.
 * Nothing reaps them yet, which is a real gap and is written down in
 * `docs/api/chat.md` rather than left for somebody to discover.
 *
 * An image shows a thumbnail, because a filename is a bad way to check you
 * picked the right photo. Everything else shows its name and size.
 */

export function ChatComposerAttachments({
  files,
  error,
  onRemove,
  onDismissError,
}: {
  files: ChatAttachment[];
  error: string | null;
  onRemove: (id: string) => void;
  onDismissError: () => void;
}) {
  if (files.length === 0 && !error) return null;

  return (
    <div className="mb-2 space-y-2">
      {error && (
        <p
          role="status"
          className="flex items-center justify-between gap-3 rounded-sm bg-danger-subtle px-3 py-1.5 text-2xs text-text-muted"
        >
          <span>{error}</span>
          <button type="button" onClick={onDismissError} className="underline">
            Dismiss
          </button>
        </p>
      )}

      <ul className="flex flex-wrap gap-2">
        {files.map((file) => {
          const src = uploadUrl(file.storedName);

          return (
            <li
              key={file.id}
              className="flex items-center gap-2 rounded-sm border border-border bg-surface-sunken py-1 pr-1 pl-2"
            >
              {isImage(file.mime) && src ? (
                <span className="relative size-8 overflow-hidden rounded-xs">
                  <AppImage src={src} alt="" fill unoptimized sizes="32px" className="object-cover" />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-8 items-center justify-center rounded-xs bg-chip text-2xs font-semibold text-text-muted"
                >
                  {isVideo(file.mime) ? "▶" : "DOC"}
                </span>
              )}

              <span className="min-w-0">
                <span className="block max-w-40 truncate text-xs text-text">{file.name}</span>
                <span className="block text-2xs text-text-subtle">
                  {formatBytes(file.size)}
                </span>
              </span>

              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => onRemove(file.id)}
                className="flex size-6 items-center justify-center rounded-full text-text-subtle transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
