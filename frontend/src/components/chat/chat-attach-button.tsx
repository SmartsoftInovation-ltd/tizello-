"use client";

import { useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { uploadFileAction } from "@/lib/actions/upload-actions";
import { MAX_UPLOAD_BYTES, formatBytes } from "@/lib/upload-limits";
import { cn } from "@/lib/cn";
import type { ChatAttachment } from "@/types/chat";

/*
 * A chip that opens the file dialog, uploads what was chosen, and hands the
 * result to the composer.
 *
 * THE UPLOAD HAPPENS ON PICK, NOT ON SEND. By the time the message goes out the
 * file is already on the server and the message carries a reference to it —
 * which is what keeps `message:send` a small JSON payload over a socket rather
 * than a file transfer, and what lets the composer show a real thumbnail and a
 * real size before anything is sent.
 *
 * IT GOES THROUGH A SERVER ACTION (`uploadFileAction`) because the session
 * cookies are `httpOnly` on the NEXT origin: a browser `fetch` straight to the
 * API is cross-origin and would carry none of them. That file explains it at
 * length; this one just obeys.
 *
 * The size check here is a courtesy — the server enforces the same 10 MB and
 * answers `413` with a sentence written for a person. Checking first saves
 * uploading ten megabytes to be told no.
 */

export function ChatAttachButton({
  accept,
  label,
  reason,
  className,
  children,
  onUploaded,
  onError,
}: {
  /** The `accept` list. Narrower than the API's allowlist by design. */
  accept: string;
  label: string;
  /** Said when the picker is opened — what this button takes. */
  reason: string;
  className?: string;
  children: React.ReactNode;
  onUploaded: (file: ChatAttachment) => void;
  onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      return onError(`Files must be ${formatBytes(MAX_UPLOAD_BYTES)} or smaller.`);
    }

    setBusy(true);

    const body = new FormData();
    body.append("file", file);

    const result = await uploadFileAction(body);

    setBusy(false);

    if (result.ok) onUploaded(result.file);
    else onError(result.message);
  };

  return (
    <>
      <button
        type="button"
        title={reason}
        aria-label={label}
        disabled={busy}
        onClick={() => input.current?.click()}
        className={cn(
          "inline-flex shrink-0 items-center justify-center transition-colors duration-100 ease-standard hover:text-text disabled:opacity-60",
          className,
        )}
      >
        {busy ? <Spinner label="Uploading" className="size-4" /> : children}
      </button>

      {/* Hidden, and reset to "" after every pick: choosing the SAME file twice
          in a row fires no `change` event otherwise, because the value has not
          changed — a classic that looks like the second upload silently
          failing. */}
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void pick(file);
        }}
      />
    </>
  );
}
