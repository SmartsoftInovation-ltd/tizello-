import { SprintCountdown } from "@/components/current-sprint/sprint-countdown";
import { SprintTimeCell } from "@/components/current-sprint/sprint-time-cell";
import { SprintWorkCell } from "@/components/current-sprint/sprint-work-cell";
import type { PointsByGroup } from "@/lib/sprint-plan";
import type { StatusSlice } from "@/lib/sprint-progress";

/**
 * The sprint's progress strip, under its header: WORK (a bar per status, in
 * each status's colour), TIME LEFT (a draining bar that changes colour as the
 * deadline nears) and the live countdown.
 *
 * Reading work and time together is the point: 30% done with a quarter of the
 * time left is the sentence a stand-up needs. Both cells share one shape
 * (`ProgressCell`) and the strip centres its cells vertically, so the two bars
 * sit on one line and the countdown sits centred beside them.
 */
export function SprintProgress({
  points,
  slices,
  capacity,
  startDate,
  endDate,
  today,
}: {
  points: PointsByGroup;
  slices: StatusSlice[];
  capacity: number | null;
  startDate: string | null;
  endDate: string | null;
  today: string;
}) {
  return (
    <div className="grid items-center gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
      <SprintWorkCell points={points} slices={slices} capacity={capacity} />
      <SprintTimeCell startDate={startDate} endDate={endDate} today={today} />

      {endDate && (
        <div className="md:col-span-2 xl:col-span-1 xl:justify-self-end">
          <SprintCountdown endDate={endDate} />
        </div>
      )}
    </div>
  );
}
