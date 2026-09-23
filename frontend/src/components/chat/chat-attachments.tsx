"use client";

import { AppImage } from "@/components/ui/app-image";
import { ClipGlyph } from "@/components/chat/chat-icons";
import { formatBytes } from "@/lib/upload-limits";
import { isImage, isVideo, uploadUrl } from "@/lib/uploads";
import type { ChatAttachment } from "@/types/chat";

/*
 * Files inside a message bubble: photos and clips shown, documents listed.
 *
 * THREE SHAPES, because three things are being asked. A photo is looked at, so
 * it is rendered. A clip is played, so it gets controls. A document is opened
 * somewhere else, so it is a row with a name, a size and a link — rendering a
 * spreadsheet inline would be a viewer, which this is not.
 *
 * A PHOTO IS SHOWN WHOLE, at its own shape, with no frame around it. It used
 * to be `object-cover` in a fixed 256×192 box, which cropped every portrait
 * photo to a letterbox and drew a grey card behind it — so a screenshot lost
 * its top and bottom and a sticker sat on a rectangle it did not fill. Width
 * is capped and height follows the image, so a tall photo is tall and a wide
 * one is wide.
 *
 * THE COST, stated: nothing stores the image's dimensions, so the browser
 * learns the aspect ratio when the bytes arrive and the bubble settles once as
 * it loads. `width`/`height` below are a RATIO HINT for that first paint, not
 * a size — the CSS overrides both. Storing real dimensions at upload time is
 * what would remove the settle, and that is an upload-module change.
 *
 * `unoptimized`, as everything served from the API is: `next.config.ts`
 * explains at length that Next's optimizer refuses private hosts outright, so
 * an entry in `remotePatterns` for `localhost:5001` is accepted by the config
 * and then rejected at request time.
 *
 * THE LINK IS `target="_blank"` WITH `rel="noreferrer"`: the file opens in the
 * API's origin, and a document viewer taking over the chat tab would lose the
 * conversation behind it.
 */

export function ChatAttachments({
  attachments,
  isOwn,
}: {
  attachments: ChatAttachment[];
  /** Tunes the document row's ink to the bubble it sits in. */
  isOwn: boolean;
}) {
  if (attachments.length === 0) return null;

  return (
    <ul className="mt-1 space-y-1.5">
      {attachments.map((file) => {
        const src = uploadUrl(file.storedName);

        if (!src) {
          /* `NEXT_PUBLIC_UPLOADS_URL` is unset, or the stored name failed its
             own shape check. Say so rather than rendering a broken frame. */
          return (
            <li key={file.id} className="text-2xs text-text-subtle italic">
              {file.name} — unavailable
            </li>
          );
        }

        if (isImage(file.mime)) {
          return (
            <li key={file.id}>
              <a href={src} target="_blank" rel="noreferrer" className="block w-fit">
                <AppImage
                  src={src}
                  alt={file.name}
                  /* A ratio hint for the first paint only — `h-auto` hands the
                     real shape back to the image once it has loaded. */
                  width={320}
                  height={320}
                  unoptimized
                  className="h-auto max-h-80 w-auto max-w-full rounded-md"
                />
              </a>
            </li>
          );
        }

        if (isVideo(file.mime)) {
          return (
            <li key={file.id}>
              {/* `preload="metadata"` so a thread of clips fetches poster
                  frames and durations rather than whole videos on load.

                  A clip keeps a frame: `bg-ink-950` is what a video shows in
                  the letterbox around its own aspect ratio anyway, and the
                  controls need something to sit on before the first frame
                  decodes. `object-contain` so nothing is cropped. */}
              <video
                src={src}
                controls
                preload="metadata"
                className="max-h-80 w-full max-w-xs rounded-md bg-ink-950 object-contain"
              >
                <track kind="captions" />
              </video>
            </li>
          );
        }

        return (
          <li key={file.id}>
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center gap-2 rounded-sm px-2 py-1.5 transition-colors duration-100 ease-standard ${
                isOwn ? "bg-brand-200/60 hover:bg-brand-200" : "bg-chip hover:bg-surface-hover"
              }`}
            >
              <ClipGlyph className="size-4 shrink-0" />
              <span className="min-w-0">
                <span className="block max-w-56 truncate text-xs font-medium">
                  {file.name}
                </span>
                <span className="block text-[10px] opacity-70">
                  {formatBytes(file.size)}
                </span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
