"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/*
 * A right-hand peek panel — Notion's, not a centred modal.
 *
 * Built on the native `<dialog>` with `showModal()`, exactly as `ui/dialog.tsx`
 * is, and for the same payoff: focus trapping, Esc-to-close, inertness of the
 * page behind, and the top layer, with no portal, no scroll lock and no
 * dependency. The difference is purely where it sits — `ml-auto` with a full
 * height instead of `m-auto` with a max width.
 *
 * A SEPARATE FILE rather than a `side` prop on `Dialog`: the two differ in
 * their entrance animation, their close affordance (a drawer carries its own
 * ✕, a dialog is dismissed by its footer) and their scroll behaviour, and
 * threading three conditionals through `Dialog` to save one file would make
 * the common case harder to read.
 *
 * Tailwind's preflight zeroes margins, which removes the UA's `margin: auto` —
 * hence the explicit `ml-auto` below rather than relying on the default.
 */
/*
 * `flex flex-col` plus a `flex-1` body is what pins the footer to the BOTTOM
 * of the panel rather than to the bottom of the content. `sticky bottom-0`
 * alone does not: sticky only engages once there is something to scroll, so on
 * a short form the footer floated up under the last field.
 */
/*
 * `[&:not([open])]:hidden` is load-bearing, and its absence was a real bug.
 *
 * The UA stylesheet hides a closed dialog with `dialog:not([open]) { display:
 * none }`. That is an element selector — specificity (0,0,1) — so the `flex`
 * this panel needs for its header/body/footer column BEAT it, and every closed
 * drawer rendered inline, in flow, one after another down the page. With a
 * "+ New project" trigger in every board column and every status group, that
 * was six invisible-by-design panels all painting at once.
 *
 * The fix is a selector that outranks `flex` rather than an ordering the build
 * might change: `.[&:not([open])]:hidden:not([open])` is (0,2,0) against
 * `.flex`'s (0,1,0), so it wins whichever order they land in.
 */
/*
 * TWO POSITIONS, ONE ELEMENT.
 *
 * `drawer` is the right-hand peek panel; `modal` is the same panel centred. It
 * is deliberately a class swap on one `<dialog>` rather than two components,
 * because the choice is live — `SurfaceMenu` flips it while the panel is open
 * — and rendering a different component type there would unmount the form
 * mid-edit and take every uncontrolled field with it. Swapping `className`
 * keeps the same DOM node, so React reconciles the children rather than
 * replacing them, and the CSS animation restarts on its own because the
 * `animation-name` changed.
 *
 * The two strings are written out in full rather than composed from a shared
 * base plus overrides. `cn` is a plain join (see `lib/cn.ts` — no
 * `tailwind-merge`), so `rounded-none` after `rounded-xl` would be two
 * utilities of equal specificity with stylesheet order picking the winner.
 *
 * `text-start` is load-bearing for the reason `ui/dialog.tsx` documents at
 * length: a `<dialog>` paints in the top layer but inherits from its DOM
 * ancestors, and this one is opened from a `<td className="text-right">` on
 * every table row. Without it the entire edit drawer — every property label,
 * every value — rendered right-aligned.
 */
const SURFACE = {
  drawer:
    "drawer-enter [&:not([open])]:hidden ml-auto flex h-dvh max-h-dvh w-full max-w-lg flex-col overflow-hidden rounded-none border-0 border-l border-border bg-surface p-0 text-start text-text shadow-modal backdrop:bg-scrim",
  modal:
    "dialog-enter [&:not([open])]:hidden m-auto flex max-h-[calc(100dvh-4rem)] w-[calc(100%-2rem)] max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface p-0 text-start text-text shadow-modal backdrop:bg-scrim",
} as const;

export type DrawerSurface = keyof typeof SURFACE;

/* React strips `autoFocus` on the client and calls .focus() during commit —
   too early, because the dialog is still closed and hidden at that point.
   Focus is therefore placed by hand once showModal() has run. */
const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function Drawer({
  open,
  onOpenChange,
  surface = "drawer",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"dialog">, "open" | "onClose"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Right-hand panel, or centred. Switchable while open — see `SURFACE` above. */
  surface?: DrawerSurface;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (open && !element.open) {
      element.showModal();
      /* A field marked `data-autofocus` wins over document order. React's own
         `autoFocus` fires during commit, while the dialog is still closed, so
         it is lost; without this the first focusable element — the header's
         surface switch — took focus, and typing a new task's title opened a
         menu instead. */
      (element.querySelector<HTMLElement>("[data-autofocus]") ?? element.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    }
    /* Closing hands focus back to whatever opened the drawer — the browser
       restores it for us, so there is nothing to do here. */
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      /* Fires for Esc and for element.close() alike, so it is the single place
         the parent's state is brought back in sync. */
      onClose={() => onOpenChange(false)}
      /* Outside-click, measured rather than inferred.
         `ui/dialog.tsx` can compare `event.target === ref.current`, because a
         centred dialog's own box is the panel and everything around it is the
         `::backdrop`. This panel is `ml-auto` in its drawer position, so that
         identity check is one layout assumption away from silently doing
         nothing — and a drawer that will not dismiss is the failure people hit
         first.
         Comparing the pointer against the panel's real rect has no such
         assumption: a click outside the box is outside it, wherever the box
         turned out to be — which is also what makes one handler correct for
         both surfaces. */
      onClick={(event) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;

        /* A TOP-LAYER POPOVER OPENED FROM INSIDE THE PANEL IS NOT OUTSIDE IT,
           whatever its coordinates say — and this was a real bug.
           `EmojiPickerPopover` places its panel BESIDE the drawer on purpose
           (a 360px picker dropped under the trigger covers the rest of the
           form). It is a DOM descendant, so its clicks bubble to this handler,
           but `showPopover()` lays it out against the viewport — so every
           click into the picker measured as outside and closed the whole
           drawer. Typing in the picker's search box was the visible symptom:
           the first click on the field dismissed the form it belonged to.
           Every menu in these panels is a popover for the same top-layer
           reasons (`use-menu-popover.ts`), so this is the general rule rather
           than a patch for one picker. */
        if ((event.target as Element | null)?.closest?.("[popover]")) return;

        /* A click dispatched by the keyboard (Enter on a button) reports 0,0
           and would otherwise read as a click in the top-left corner — that is
           outside the panel, so every keyboard activation would close it. */
        if (event.clientX === 0 && event.clientY === 0) return;

        const inside =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom;

        if (!inside) onOpenChange(false);
      }}
      className={cn(SURFACE[surface], className)}
      {...props}
    >
      {children}
    </dialog>
  );
}

/** Fixed at the top of the panel — the body below it is what scrolls. */
export function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-b border-border bg-surface px-5 py-3",
        className,
      )}
      {...props}
    />
  );
}

/**
 * `flex-1` claims the space between header and footer; `overflow-y-auto` is
 * here rather than on the panel so the two sticky bars never scroll.
 *
 * NO VISIBLE SCROLLBAR (`scrollbar-hidden`), still fully scrollable — wheel,
 * trackpad, touch, keyboard and `scrollTop` all work untouched. A panel this
 * narrow spent 15px of its width on a grey bar running between the header and
 * footer rules, which is the loudest vertical line in a form whose own fields
 * are hairlines. The same choice the pickers and the filter dialog already
 * make.
 *
 * It is a real trade — a hidden scrollbar is a hidden affordance — and it is
 * paid for here by the header and footer: content clipped against two fixed
 * bars reads as "there is more", where a free-floating region would not.
 */
export function DrawerBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-5 py-4", className)} {...props} />;
}

/**
 * The flex column a drawer's `<form>` has to be for the footer to pin. A
 * component rather than a note in the docblock, because a caller that forgets
 * gets a subtly wrong layout rather than an error.
 */
export function DrawerForm({ className, ...props }: React.ComponentProps<"form">) {
  return <form className={cn("flex min-h-0 flex-1 flex-col", className)} {...props} />;
}

/** Pinned to the bottom edge — the save button must not scroll away from a long property list. */
export function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface px-5 py-3",
        className,
      )}
      {...props}
    />
  );
}
