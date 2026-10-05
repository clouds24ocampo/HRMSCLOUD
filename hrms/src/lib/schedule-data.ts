import { prisma } from "@/lib/prisma";
import { dbDate, keyOfDbDate } from "@/lib/time";
import { resolveRange, type RegularRow, type Resolved, type ShiftLite } from "@/lib/schedule";

const SHIFT = { select: { name: true, startTime: true, endTime: true, breakMinutes: true } } as const;

export type PersonSchedule = { regulars: RegularRow[]; overrides: Map<string, { shift: ShiftLite | null }> };

// Loads regular schedules (all that started on or before `to`, so the one in effect on `from` is included)
// and the specific-day overrides inside the range, for the given people. Always limited to one organization.
export async function loadSchedules(organizationId: string, employeeIds: string[], from: string, to: string): Promise<Map<string, PersonSchedule>> {
  const [regs, entries] = await Promise.all([
    prisma.regularSchedule.findMany({
      where: { organizationId, employeeId: { in: employeeIds }, effectiveFrom: { lte: dbDate(to) } },
      include: { shift: SHIFT },
      orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
    }),
    prisma.scheduleEntry.findMany({
      where: { organizationId, employeeId: { in: employeeIds }, date: { gte: dbDate(from), lte: dbDate(to) } },
      include: { shift: SHIFT },
    }),
  ]);
  const out = new Map<string, PersonSchedule>(employeeIds.map((id) => [id, { regulars: [], overrides: new Map() }]));
  for (const r of regs) out.get(r.employeeId)!.regulars.push({ effectiveFrom: keyOfDbDate(r.effectiveFrom), workDays: r.workDays, shift: r.shift });
  for (const e of entries) out.get(e.employeeId)!.overrides.set(keyOfDbDate(e.date), { shift: e.shift });
  return out;
}

export const resolvePerson = (s: PersonSchedule | undefined, days: string[]): Map<string, Resolved> =>
  s ? resolveRange(days, s.overrides, s.regulars) : new Map();
