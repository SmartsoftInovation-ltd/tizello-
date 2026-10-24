import { cn } from "@/lib/cn";

/*
 * A hover-and-focus readout for one chart mark — CSS only, so the dashboard
 * ships no JavaScript for it.
 *
 * The mark itself is the hit target and is focusable, so a keyboard reader
 * gets the same readout as a pointer. VALUE LEADS, LABEL FOLLOWS (the dataviz
 * interaction rule): the reader already knows which mark they are on and wants
 * the number. A tooltip only ENHANCES here — every value is also printed as
 * text beside the chart or in its table view, so nothing is gated behind hover.
 */
export function ChartTip({
  value,
  label,
  className,
  children,
}: {
  value: string;
  label: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      tabIndex={0}
      aria-label={`${label}: ${value}`}
      className={cn("group/tip relative block cursor-default outline-offset-2", className)}
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-md border border-border bg-surface px-2.5 py-1.5 whitespace-nowrap opacity-0 shadow-overlay transition-opacity duration-150 ease-standard group-hover/tip:opacity-100 group-focus-visible/tip:opacity-100"
      >
        <span className="block text-sm font-semibold text-text">{value}</span>
        <span className="block text-2xs text-text-subtle">{label}</span>
      </span>
    </span>
  );
}
