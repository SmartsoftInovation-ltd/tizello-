"use client";

import { useLinkStatus } from "next/link";
import { createPortal } from "react-dom";
import { PageLoader } from "@/components/ui/page-loader";

/*
 * Shows the centred PageLoader while the `<Link>` it sits inside is navigating.
 *
 * WHY THIS EXISTS NEXT TO `loading.tsx`. A link that only changes the search
 * params (`?view=board` → `?view=status`) stays inside the same route segment,
 * so Next never swaps in that segment's `loading.tsx` — it keeps the old screen
 * up until the server payload lands, which on this page is several fetches.
 * `useLinkStatus` is the one signal for that wait.
 *
 * Must render as a DESCENDANT of a `<Link>` — that is how the hook finds which
 * link to report on. Portalled to `body` so the loader is not an `<a>`'s
 * child in the accessibility tree, and no ancestor's `overflow` or `transform`
 * can clip or re-anchor its `fixed` box. PageLoader already delays its own
 * fade-in by 150ms, so a prefetched, instant switch never flashes it.
 */
export function LinkPendingLoader({ label }: { label?: string }) {
  const { pending } = useLinkStatus();

  if (!pending || typeof document === "undefined") return null;
  return createPortal(<PageLoader label={label} />, document.body);
}
