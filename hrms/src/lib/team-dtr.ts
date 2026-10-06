// DTR for many people at once (Live Personnel and Analytics). Same calculator as the DTR page, just batched queries.
import { prisma } from "@/lib/prisma";
import { buildDtr, clockStatus, type DtrDay, type ShiftTimes } from "@/lib/dtr";
import { STAMP_SELECT, toPunch } from "@/lib/punch";
import { loadSchedules, resolvePerson } from "@/lib/schedule-data";
import { addDays, daysBetween, dayKey, dbDate, keyOfDbDate, zonedTimeToUtc } from "@/lib/time";
import { liveState, type LiveState } from "@/lib/live";

export async function loadTeamDtr(organizationId: string, ids: string[], from: string, to: string, tz: string, graceMinutes: number): Promise<Map<string, DtrDay[]>> {
  const days = daysBetween(from, to).slice(0, 62);
  const last = days[days.length - 1];
  const [events, schedules, leave] = await Promise.all([
    prisma.timeEvent.findMany({
      where: { organizationId, employeeId: { in: ids }, voidedAt: null, at: { gte: zonedTimeToUtc(addDays(from, -1), 0, tz), lt: zonedTimeToUtc(addDays(last, 2), 0, tz) } },
      include: { stampType: { select: STAMP_SELECT } },
      orderBy: { at: "asc" },
    }),
    loadSchedules(organizationId, ids, from, last),
    prisma.leaveRequest.findMany({
      where: { organizationId, employeeId: { in: ids }, status: "APPROVED", startDate: { lte: dbDate(last) }, endDate: { gte: dbDate(from) } },
      select: { employeeId: true, startDate: true, endDate: true },
    }),
  ]);
  const byEmp = new Map<string, typeof events>();
  for (const e of events) byEmp.set(e.employeeId, [...(byEmp.get(e.employeeId) ?? []), e]);
  const leaveBy = new Map<string, Set<string>>();
  for (const l of leave) {
    const set = leaveBy.get(l.employeeId) ?? new Set<string>();
    daysBetween(keyOfDbDate(l.startDate), keyOfDbDate(l.endDate)).forEach((d) => set.add(d));
    leaveBy.set(l.employeeId, set);
  }
  const today = dayKey(new Date(), tz);
  return new Map(ids.map((id) => {
    const resolved = resolvePerson(schedules.get(id), days);
    const schedule = new Map<string, ShiftTimes | null>([...resolved].map(([d, r]) => [d, r.shift]));
    return [id, buildDtr({ days, punches: (byEmp.get(id) ?? []).map(toPunch), schedule, leaveDays: leaveBy.get(id) ?? new Set(), today, tz, graceMinutes })];
  }));
}

export type LiveRow = { id: string; state: LiveState; detail?: string; shift: ShiftTimes | null | undefined; firstIn: Date | null };

// Right now: state of each person from today's plan and their recent punches.
export async function loadLive(organizationId: string, ids: string[], tz: string, graceMinutes: number): Promise<Map<string, LiveRow>> {
  const now = new Date();
  const day = dayKey(now, tz);
  const [events, schedules, leave] = await Promise.all([
    prisma.timeEvent.findMany({
      where: { organizationId, employeeId: { in: ids }, voidedAt: null, at: { gte: new Date(now.getTime() - 36 * 3600_000) } },
      include: { stampType: { select: STAMP_SELECT } },
      orderBy: { at: "asc" },
    }),
    loadSchedules(organizationId, ids, day, day),
    prisma.leaveRequest.findMany({ where: { organizationId, employeeId: { in: ids }, status: "APPROVED", startDate: { lte: dbDate(day) }, endDate: { gte: dbDate(day) } }, select: { employeeId: true } }),
  ]);
  const onLeave = new Set(leave.map((l) => l.employeeId));
  const byEmp = new Map<string, typeof events>();
  for (const e of events) byEmp.set(e.employeeId, [...(byEmp.get(e.employeeId) ?? []), e]);
  return new Map(ids.map((id) => {
    const evs = byEmp.get(id) ?? [];
    const todays = evs.filter((e) => dayKey(e.at, tz) === day && e.type === "IN");
    const clock = clockStatus(evs.map(toPunch));
    const shift = resolvePerson(schedules.get(id), [day]).get(day)?.shift;
    const r = liveState({ now, day, tz, shift, onLeave: onLeave.has(id), clock, timedInToday: todays.length > 0, graceMinutes });
    return [id, { id, ...r, shift, firstIn: todays[0]?.at ?? null }];
  }));
}
