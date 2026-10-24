/*
 * The route-transition loader: four colour bars that sweep through each other
 * and stretch, centred on the screen. The drawing is the `page-loader` utility
 * in globals.css (adapted from Uiverse.io, SchawnnahJ).
 *
 * Every `loading.tsx` under `src/app` renders this, and so does
 * `LinkPendingLoader` for same-route switches like `?view=`. A page-shaped
 * skeleton has to mirror its page's layout or it jumps when the content lands;
 * one centred mark cannot drift.
 *
 * `fixed inset-0` centres on the VIEWPORT, not on the content pane — which
 * shifts with the sidebar's width. The same box is a faded, lightly blurred
 * veil over the whole app that CATCHES clicks: nothing underneath can be
 * pressed while the next screen loads, so a second click cannot start a
 * second navigation or act on the screen that is about to be replaced.
 *
 * `text-xl` sizes the mark: the utility is all `em`, so 24px → a 60px box.
 * `loader-board` fades the veil and mark in after 150ms, so an instant switch
 * never flashes — the veil blocks clicks from the first frame, though.
 * No visible caption — the label is `sr-only`, announced once by
 * `role="status"`; the drawing is `aria-hidden`.
 */
export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="loader-board fixed inset-0 z-40 grid place-items-center bg-canvas/60 backdrop-blur-[2px]">
      <div role="status" className="grid place-items-center">
        <span aria-hidden="true" className="page-loader text-xl" />
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}
