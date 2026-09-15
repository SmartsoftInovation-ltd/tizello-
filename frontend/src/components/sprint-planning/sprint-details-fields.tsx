"use client";

import { DateField } from "@/components/ui/date-field";
import { TextArea } from "@/components/ui/text-area";

/**
 * The dates and goal shared by the create/edit dialog and the start dialog.
 *
 * A date pair is checked HERE, as the person picks, rather than only on save:
 * an end before the start is the one mistake the calendar makes easy, and the
 * API's `422` for it would otherwise land on a dialog that already closed.
 */
export type SprintDates = { startDate: string; endDate: string };

export function datesError({ startDate, endDate }: SprintDates): string | undefined {
  return startDate && endDate && endDate < startDate ? "The end date must be on or after the start date." : undefined;
}

export function SprintDetailsFields({
  dates,
  goal,
  today,
  onDates,
  onGoal,
}: {
  dates: SprintDates;
  goal: string;
  today: string;
  onDates: (dates: SprintDates) => void;
  onGoal: (goal: string) => void;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <DateField
          label="Start date"
          value={dates.startDate}
          today={today}
          placeholder="Pick a date"
          onChange={(startDate) => onDates({ ...dates, startDate })}
        />
        <DateField
          label="End date"
          value={dates.endDate}
          today={today}
          placeholder="Pick a date"
          error={datesError(dates)}
          onChange={(endDate) => onDates({ ...dates, endDate })}
        />
      </div>

      <TextArea
        label="Sprint goal"
        name="goal"
        rows={2}
        maxLength={500}
        defaultValue={goal}
        placeholder="What this sprint is for, in one sentence"
        onValueChange={onGoal}
      />
    </>
  );
}
