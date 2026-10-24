import { cn } from "@/lib/cn";

/*
 * The route-transition loader: a tiny three-column board whose card hops
 * To do → In progress → Done, centred on the screen.
 *
 * Every `loading.tsx` under `src/app` renders this instead of a page-shaped
 * skeleton. A skeleton has to mirror its page's exact layout or it jumps when
 * the content lands, and fourteen hand-copied layouts drift; one centred mark
 * cannot.
 *
 * `fixed inset-0` centres on the VIEWPORT, not on the content pane — which
 * shifts with the sidebar's width. `pointer-events-none` keeps the shell
 * (sidebar, header) clickable underneath, so a reader can change their mind
 * mid-navigation.
 *
 * All motion lives in globals.css §7 under `prefers-reduced-motion:
 * no-preference`; `reduce` sees the card resting in the first column — still
 * a board, just not moving. Only transform and opacity animate.
 *
 * `role="status"` with the label, so the wait is announced once; the drawing
 * is `aria-hidden`.
 */
const COLUMNS = [
  { id: "todo", stack: "bg-text-subtle/40", delays: ["", "[animation-delay:80ms]"] },
  { id: "doing", stack: "bg-info/50", delays: ["[animation-delay:160ms]", "[animation-delay:240ms]"] },
  { id: "done", stack: "bg-success/50", delays: ["[animation-delay:320ms]", "[animation-delay:400ms]"] },
] as const;

export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center">
      <div role="status" className="loader-board flex flex-col items-center gap-4">
        <div aria-hidden="true" className="relative flex gap-1.5">
          {COLUMNS.map((column) => (
            <div
              key={column.id}
              className="flex h-14 w-5 flex-col justify-end gap-1 rounded-md border border-border bg-surface-sunken p-1 shadow-card"
            >
              {column.delays.map((delay) => (
                <span
                  key={delay || "first"}
                  className={cn("loader-stack h-1.5 rounded-xs", column.stack, delay)}
                />
              ))}
            </div>
          ))}

          {/* The travelling card. Starts over column one's top slot; the
              keyframes step it 26px (w-5 + gap-1.5) per column. */}
          <span className="loader-card absolute top-1.5 left-[3px] h-2.5 w-3.5 rounded-xs bg-brand shadow-raised" />
        </div>

        <p className="flex items-baseline text-xs font-medium text-text-muted">
          {label}
          <span aria-hidden="true" className="ml-0.5 inline-flex gap-0.5">
            <span className="loader-dot size-1 rounded-full bg-current" />
            <span className="loader-dot size-1 rounded-full bg-current [animation-delay:150ms]" />
            <span className="loader-dot size-1 rounded-full bg-current [animation-delay:300ms]" />
          </span>
        </p>
      </div>
    </div>
  );
}
