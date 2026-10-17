// "Where is everyone right now?" from today's plan and recent punches. Pure.
import { shiftInstants, type ClockStatus, type ShiftTimes } from "@/lib/dtr";

export type LiveState = "WORKING" | "ON_BREAK" | "DONE" | "LATE" | "ABSENT_RISK" | "NOT_YET" | "DAY_OFF" | "ON_LEAVE" | "NO_SCHEDULE";
export const ABSENT_AFTER_MINUTES = 120; // matches the auto-absent rule: no Time In 2 h after shift start

export function liveState(i: {
  now: Date; day: string; tz: string; shift: ShiftTimes | null | undefined; onLeave: boolean; clock: ClockStatus; timedInToday: boolean; graceMinutes: number;
}): { state: LiveState; detail?: string } {
  if (i.onLeave) return { state: "ON_LEAVE" };
  // What the clock says comes first: someone without a schedule (or on a flexible one) who is working is working.
  if (i.clock.state === "ON_PAUSE") return { state: "ON_BREAK", detail: i.clock.pause?.name };
  if (i.clock.state === "IN") return { state: "WORKING" };
  if (i.timedInToday) return { state: "DONE" };
  if (i.shift === undefined) return { state: "NO_SCHEDULE" };
  if (i.shift === null) return { state: "DAY_OFF" };
  const { start } = shiftInstants(i.day, i.shift, i.tz);
  const late = Math.floor((i.now.getTime() - start.getTime()) / 60000);
  if (late <= i.graceMinutes) return { state: "NOT_YET", detail: late < 0 ? `starts in ${-late} min` : undefined };
  return late >= ABSENT_AFTER_MINUTES ? { state: "ABSENT_RISK", detail: `${late} min after start` } : { state: "LATE", detail: `${late} min late` };
}
