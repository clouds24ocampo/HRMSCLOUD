// Home dashboard figures that are not already a page of their own. Pure, so the projection is explainable and tested.
import type { DtrDay } from "@/lib/dtr";
import { shiftMinutes } from "@/lib/adherence";

// Planned paid minutes still ahead: scheduled days after today, not on leave, each capped at a normal day.
// Flexible workers have no planned shifts, so nothing is projected for them.
export function remainingPlannedMinutes(rows: DtrDay[], today: string, capMinutes: number): number {
  let total = 0;
  for (const r of rows) {
    if (r.day <= today || !r.shift || r.status === "LEAVE") continue;
    total += Math.min(shiftMinutes(r.shift), capMinutes);
  }
  return total;
}

// Projected gross for the cut-off: what payroll has already computed, plus basic pay for the planned shifts still ahead.
// hourlyCents: employeeId -> hourly rate in cents. Anyone without a rate adds nothing.
export function projectCutoffGross(earnedGrossCents: number, remaining: Map<string, number>, hourlyCents: Map<string, number>): { projected: number; ahead: number } {
  let ahead = 0;
  for (const [id, minutes] of remaining) {
    const rate = hourlyCents.get(id);
    if (rate) ahead += Math.round((rate * minutes) / 60);
  }
  return { projected: earnedGrossCents + ahead, ahead };
}
