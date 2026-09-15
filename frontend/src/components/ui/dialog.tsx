"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/*
 * The native <dialog> element, opened with showModal().
 *
 * That one call buys focus trapping, Esc-to-close, inertness of the page
 * behind, and the top layer — no portal, no scroll lock, no dependency. The
 * part names mirror shadcn's so a real swap stays a file replacement; the
 * difference is that `Dialog` IS the panel here rather than a context provider.
 *
 * Tailwind's preflight zeroes margins on every element, which removes the UA's
 * `margin: auto` centring — hence the explicit `m-auto` below.
 */
/*
 * `text-start` is load-bearing, and its absence was a real bug.
 *
 * A `<dialog>` paints in the top layer but it is still a DOM DESCENDANT of
 * whatever rendered it, so it inherits that subtree's typography. The project
 * actions menu is mounted inside a `<td className="w-9 text-right">` — the
 * alignment that pushes the ⋯ button to the cell's right edge — and every
 * dialog it opened inherited it: the Delete confirmation's title, its
 * paragraph and its field label all rendered right-aligned, in the middle of
 * an otherwise left-aligned app.
 *
 * Fixed here rather than on that one cell, because the cell is not wrong. An
 * overlay that covers the whole viewport is not visually inside the box it was
 * declared in, so inheriting that box's alignment is never what anyone means —
 * and the next `text-right` cell to gain a dialog would rediscover this.
 *
 * `text-start`, not `text-left`: it resets the inherited value without
 * hard-coding a direction an RTL locale would need to flip.
 */
const PANEL =
  "dialog-enter m-auto w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-4rem)] overflow-y-auto rounded-xl border border-border bg-surface p-0 text-start text-text shadow-modal backdrop:bg-scrim";

/* React strips `autoFocus` on the client and calls .focus() during commit —
   which is too early, because the dialog is still closed and hidden at that
   point. Focus is therefore placed by hand once showModal() has run. */
const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  onOpenChange,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"dialog">, "open" | "onClose"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      /* `data-autofocus` wins over document order, as in `ui/drawer.tsx`. */
      (element.querySelector<HTMLElement>("[data-autofocus]") ?? element.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    }
    /* Closing hands focus back to whatever opened the dialog — the browser
       restores it for us, so there is nothing to do here. */
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      /* Fires for Esc and for element.close() alike, so it is the single place
         the parent's state is brought back in sync. */
      onClose={() => onOpenChange(false)}
      /* The backdrop is part of the dialog's own box, so a click that lands on
         the element itself — rather than on the content inside it — is a click
         outside. */
      onClick={(event) => {
        if (event.target === ref.current) onOpenChange(false);
      }}
      className={cn(PANEL, className)}
      {...props}
    >
      {children}
    </dialog>
  );
}

export function DialogContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-lg font-semibold tracking-tight text-text", className)}
      {...props}
    />
  );
}

export function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-text-muted", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
