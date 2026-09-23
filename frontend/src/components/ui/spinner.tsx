import { cn } from "@/lib/cn";

/*
 * A tiny indeterminate ring, for the wait between pressing something and the
 * server answering.
 *
 * WHY A COMPONENT AND NOT "Saving…". The rest of this app says the word,
 * because it is usually inside a button that is already disabled and the word
 * is more precise than a shape. Chat is the exception: its waits are
 * round-trips over a socket, they happen inside bubbles and beside timestamps
 * where there is no room for a sentence, and they are short enough that a
 * changing label reads as a flicker.
 *
 * `currentColor` and an em-based size, so it inherits from whatever it sits in
 * — a brand-ink bubble, a danger button, a muted metadata row — instead of
 * carrying a palette of its own.
 *
 * `motion-reduce:animate-none` leaves a static ring for anyone who asked the
 * OS for less motion: still a "something is happening" mark, just not spinning.
 * A bare `animate-spin` is one of the few things in an app that genuinely
 * cannot be paused by the reader.
 *
 * `role="status"` with a label, so the wait is announced once rather than
 * being a decorative circle a screen reader never mentions.
 */
export function Spinner({
  className,
  label = "Working…",
}: {
  className?: string;
  /** What is being waited for. Announced; never drawn. */
  label?: string;
}) {
  return (
    <span role="status" aria-label={label} className="inline-flex">
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className={cn("size-[1em] animate-spin motion-reduce:animate-none", className)}
      >
        {/* The track, then the arc: one circle at low opacity and one quarter
            of a circle at full, which is the whole trick — a dash array of
            "quarter, rest" on the same geometry. */}
        <circle
          cx="8"
          cy="8"
          r="6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.25"
        />
        <circle
          cx="8"
          cy="8"
          r="6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="10 31"
        />
      </svg>
    </span>
  );
}
