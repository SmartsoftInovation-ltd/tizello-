import { ProgressCell } from "@/components/current-sprint/progress-cell";
import { cn } from "@/lib/cn";
import { formatDeadline } from "@/lib/format-date";
import { daysInclusive, daysRemaining } from "@/lib/sprint-dates";
import { timeLeft, type TimeTone } from "@/lib/sprint-progress";

/**
 * TIME: how much of the time-box is LEFT. Full on day one, draining as the
 * days pass, and changing colour as it drains — green while more than half is
 * left, yellow at half, orange at a quarter, red on the last day and overdue.
 * Tones and thresholds live in `lib/sprint-progress.ts`.
 *
 * The caption names the deadline instead of counting toward it: the countdown
 * beside the strip is the one place time left is a ticking number.
 */
const TONE: Record<TimeTone, { fill: string; text: string }> = {
  plenty: { fill: "bg-brand-500", text: "text-text" },
  half: { fill: "bg-warning", text: "text-warning" },
  low: { fill: "bg-label-orange", text: "text-warning" },
  critical: { fill: "bg-danger", text: "text-danger" },
};

const day = (iso: string) => iso.slice(0, 10);

export function SprintTimeCell({
  startDate,
  endDate,
  today,
}: {
  startDate: string | null;
  endDate: string | null;
  today: string;
}) {
  if (!startDate || !endDate) {
    return (
      <ProgressCell label="Time" value="No dates set" caption="Set dates to track time">
        <span />
      </ProgressCell>
    );
  }

  const length = daysInclusive(day(startDate), day(endDate));
  const left = daysRemaining(today, day(endDate));
  const late = left < 1;
  const { percent, tone } = timeLeft(length, left);

  return (
    <ProgressCell
      label="Time left"
      value={
        late ? (
          <span className="font-semibold text-danger">{-left + 1} days overdue</span>
        ) : (
          <>
            <span className={cn("font-semibold", TONE[tone].text)}>
              {left} {left === 1 ? "day" : "days"}
            </span>{" "}
            of {length}
          </>
        )
      }
      caption={late ? `Ended ${formatDeadline(endDate)}` : left === 1 ? `Last day — ends ${formatDeadline(endDate)}` : `Ends ${formatDeadline(endDate)}`}
    >
      <span
        className={cn("rounded-full transition-[width] duration-500 ease-standard", TONE[tone].fill)}
        style={{ width: `${percent}%` }}
      />
    </ProgressCell>
  );
}
