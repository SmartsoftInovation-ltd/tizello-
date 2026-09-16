"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

/**
 * A live countdown to the sprint's end — days, hours, minutes, seconds.
 *
 * Minimal on purpose: a small "Ends in" label and four quiet `surface-hover`
 * tiles with their units under them, no panel around it. It sits beside the
 * work and time bars, so it should read as one more measurement, not a banner.
 *
 * The deadline is the END of the end date (23:59:59 in the viewer's zone): a
 * sprint that ends on the 21st is still running all of the 21st, which is also
 * how "days left" counts it.
 *
 * CLOCK THROUGH `useSyncExternalStore`, not an effect. The snapshot is the
 * current whole second, so React re-renders once a second and never between;
 * the SERVER snapshot is `null`, so the server and the first client pass both
 * draw placeholders and hydration cannot disagree about "now".
 *
 * Past the deadline it counts UP in `danger`, labelled "Overdue by".
 */
const subscribe = (tick: () => void) => {
  const timer = window.setInterval(tick, 1000);
  return () => window.clearInterval(timer);
};
const nowSecond = () => Math.floor(Date.now() / 1000);
const serverSecond = () => null;

function deadlineSecond(endDate: string): number {
  const [year, month, day] = endDate.slice(0, 10).split("-").map(Number);
  return Math.floor(new Date(year, month - 1, day, 23, 59, 59).getTime() / 1000);
}

const pad = (value: number) => String(value).padStart(2, "0");

export function SprintCountdown({ endDate }: { endDate: string }) {
  const now = useSyncExternalStore(subscribe, nowSecond, serverSecond);
  const diff = now === null ? null : deadlineSecond(endDate) - now;
  const overdue = diff !== null && diff < 0;
  const total = diff === null ? 0 : Math.abs(diff);

  const units = [
    { label: "Days", value: String(Math.floor(total / 86_400)) },
    { label: "Hrs", value: pad(Math.floor(total / 3600) % 24) },
    { label: "Min", value: pad(Math.floor(total / 60) % 60) },
    { label: "Sec", value: pad(total % 60) },
  ];
  const title = overdue ? "Overdue by" : "Ends in";

  return (
    <div>
      <p className={cn("text-2xs font-semibold tracking-widest uppercase", overdue ? "text-danger" : "text-text-subtle")}>{title}</p>
      <div
        role="timer"
        aria-label={diff === null ? "Loading countdown" : `${title} ${units.map((unit) => `${unit.value} ${unit.label}`).join(", ")}`}
        className="mt-1.5 flex items-start gap-1"
      >
        {units.map((unit, index) => (
          <div key={unit.label} className="flex items-start gap-1">
            {index > 0 && (
              <span aria-hidden="true" className="flex h-8 items-center text-xs font-semibold text-text-subtle">
                :
              </span>
            )}
            <div aria-hidden="true" className="flex flex-col items-center">
              <span
                className={cn(
                  "grid h-8 min-w-9 place-items-center rounded-md px-1.5 font-mono text-base font-semibold tabular-nums",
                  overdue ? "bg-danger-subtle text-danger" : "bg-surface-hover text-text",
                )}
              >
                {diff === null ? "--" : unit.value}
              </span>
              <span className="mt-1 text-[0.625rem] font-medium tracking-wider text-text-subtle uppercase">{unit.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
